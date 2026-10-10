import os
import numpy as np
from PIL import Image

def process_sprite(src_path):
    img = Image.open(src_path).convert('RGBA')
    arr = np.array(img, dtype=np.float32)
    r, g, b, a = arr[:,:,0], arr[:,:,1], arr[:,:,2], arr[:,:,3]
    
    # 1. Magenta key
    is_magenta = (r > 130) & (b > 130) & (g < 110) & (abs(r - b) < 65) & ((r - g) > 50) & ((b - g) > 50)
    
    # 2. Dark borders
    is_dark = (r < 25) & (g < 25) & (b < 25)
    
    # 3. Despill magenta
    fringe = (~is_magenta) & (~is_dark) & (r > g) & (b > g) & ((r - g) > 25) & ((b - g) > 25)
    despill = np.clip(np.minimum(r - g, b - g) * 0.75, 0, 255)
    r[fringe] -= despill[fringe]
    b[fringe] -= despill[fringe]
    
    alpha = np.where(is_magenta | is_dark, 0.0, 255.0)
    arr[:,:,0] = np.clip(r, 0, 255)
    arr[:,:,1] = np.clip(g, 0, 255)
    arr[:,:,2] = np.clip(b, 0, 255)
    arr[:,:,3] = alpha
    return Image.fromarray(arr.astype(np.uint8), 'RGBA')

def main():
    base = r'C:\Users\pdard\OneDrive\Desktop\voxel games\gauntlet legends\Gauntlet Shooter\assets\sprites'
    for name in ['valkyrie', 'elf', 'wizard']:
        src = os.path.join(base, f'{name}.jpg')
        dst = os.path.join(base, f'{name}.png')
        if os.path.exists(src):
            res = process_sprite(src)
            res.save(dst, 'PNG')
            print(f'Processed and saved: {dst}')

if __name__ == '__main__':
    main()
