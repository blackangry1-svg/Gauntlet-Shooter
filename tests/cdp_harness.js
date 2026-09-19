import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

export class CDPHarness {
  constructor(options = {}) {
    this.port = options.port || 9222;
    this.width = options.width || 1280;
    this.height = options.height || 720;
    this.chromeProc = null;
    this.ws = null;
    this.msgId = 1;
    this.pending = new Map();
    this.consoleLogs = [];
    this.errors = [];
  }

  async launch(url = 'about:blank') {
    const userDataDir = `C:\\Users\\pdard\\AppData\\Local\\Temp\\chrome_cdp_${Date.now()}`;
    this.chromeProc = spawn(CHROME_PATH, [
      '--headless=new',
      `--remote-debugging-port=${this.port}`,
      '--remote-allow-origins=*',
      `--window-size=${this.width},${this.height}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-translate',
      '--hide-scrollbars',
      '--mute-audio',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-gpu-shader-disk-cache',
      url
    ], { stdio: 'ignore' });

    // Poll until debugging port is accessible and has a page target
    let pageWsUrl = null;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 200));
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/json/list`);
        if (res.ok) {
          const list = await res.json();
          const page = list.find(t => t.type === 'page');
          if (page && page.webSocketDebuggerUrl) {
            pageWsUrl = page.webSocketDebuggerUrl;
            break;
          }
        }
      } catch (e) {
        // Retry
      }
    }

    if (!pageWsUrl) {
      throw new Error(`Failed to find page target on Chrome CDP port ${this.port}`);
    }

    this.ws = new WebSocket(pageWsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value ?? a.description ?? JSON.stringify(a)).join(' ');
        this.consoleLogs.push({ type: msg.params.type, text });
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const desc = msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text;
        this.errors.push(desc);
      }
    };

    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('DOM.enable');
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 1200));
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    }
    return res.result?.value;
  }

  async captureScreenshot(outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    writeFileSync(outputPath, buffer);
    return outputPath;
  }

  async close() {
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
    }
    if (this.chromeProc) {
      try { this.chromeProc.kill(); } catch (_) {}
    }
  }
}
