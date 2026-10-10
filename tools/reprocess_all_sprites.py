import os
import shutil
import numpy as np
from PIL import Image

BRAIN_DIR = r'C:\Users\pdard\.gemini\antigravity\brain\78b09eff-8e83-4d3c-a17c-395a377658d8'
SPRITE_DIR = r'c:\Users\pdard\OneDrive\Desktop\voxel games\gauntlet legends\Gauntlet Shooter\assets\sprites'
BACKUP_DIR = r'c:\Users\pdard\OneDrive\Desktop\voxel games\gauntlet legends\Gauntlet Shooter\assets\sprites_backup'

SHEET_CONFIGS = [
    {
        'name': 'warrior',
        'src': os.path.join(BRAIN_DIR, 'hero_warrior_sheet_1790465231636.jpg'),
        'rows': 6, 'cols': 8, 'target_rows': 6, 'target_cols': 6,
        'col_map': [0, 1, 2, 4, 5, 7],
        'is_white_bg': False, 'is_flying': False
    },
    {
        'name': 'valkyrie',
        'src': os.path.join(BRAIN_DIR, 'hero_valkyrie_sheet_1790465246948.jpg'),
        'rows': 6, 'cols': 6, 'target_rows': 6, 'target_cols': 6,
        'is_white_bg': False, 'is_flying': False
    },
    {
        'name': 'elf',
        'src': os.path.join(BRAIN_DIR, 'hero_elf_sheet_1790465262827.jpg'),
        'rows': 6, 'cols': 6, 'target_rows': 6, 'target_cols': 6,
        'is_white_bg': True, 'is_flying': False
    },
    {
        'name': 'wizard',
        'src': os.path.join(BRAIN_DIR, 'hero_wizard_sheet_1790465283153.jpg'),
        'rows': 6, 'cols': 6, 'target_rows': 6, 'target_cols': 6,
        'is_white_bg': False, 'is_flying': False
    },
    {
        'name': 'minotaur',
        'src': os.path.join(BRAIN_DIR, 'boss_minotaur_sheet_1790465299424.jpg'),
        'rows': 6, 'cols': 6, 'target_rows': 6, 'target_cols': 6,
        'is_white_bg': False, 'is_flying': False
    },
    {
        'name': 'orc_grunt',
        'src': os.path.join(BRAIN_DIR, 'enemy_orc_grunt_sheet_1790465318284.jpg'),
        'rows': 6, 'cols': 6, 'target_rows': 6, 'target_cols': 6,
        'is_white_bg': False, 'is_flying': False
    },
    {
        'name': 'skeleton_archer',
        'src': os.path.join(BRAIN_DIR, 'enemy_skeleton_archer_sheet_1790465334780.jpg'),
        'rows': 6, 'cols': 6, 'target_rows': 6, 'target_cols': 6,
        'is_white_bg': False, 'is_flying': False
    },
    {
        'name': 'stone_golem',
        'src': os.path.join(BRAIN_DIR, 'enemy_stone_golem_sheet_1790465355913.jpg'),
        'rows': 4, 'cols': 4, 'target_rows': 4, 'target_cols': 4,
        'is_white_bg': False, 'is_flying': False
    },
    {
        'name': 'death_bat',
        'src': os.path.join(BRAIN_DIR, 'enemy_death_bat_sheet_1790465374313.jpg'),
        'rows': 6, 'cols': 6, 'target_rows': 6, 'target_cols': 6,
        'is_white_bg': False, 'is_flying': True
    },
    {
        'name': 'death_knight',
        'src': os.path.join(BRAIN_DIR, 'boss_death_knight_sheet_1790465392050.jpg'),
        'rows': 6, 'cols': 6, 'target_rows': 6, 'target_cols': 6,
        'is_white_bg': False, 'is_flying': False
    },
    {
        'name': 'champion_orc',
        'src': os.path.join(BACKUP_DIR, 'champion_orc.png'),
        'rows': 6, 'cols': 6, 'target_rows': 6, 'target_cols': 6,
        'is_white_bg': False, 'is_flying': False
    },
    {
        'name': 'dark_acolyte',
        'src': os.path.join(BACKUP_DIR, 'dark_acolyte.png'),
        'rows': 4, 'cols': 6, 'target_rows': 4, 'target_cols': 6,
        'is_white_bg': False, 'is_flying': False
    },
    {
        'name': 'lava_golem',
        'src': os.path.join(BACKUP_DIR, 'lava_golem.png'),
        'rows': 4, 'cols': 4, 'target_rows': 4, 'target_cols': 4,
        'is_white_bg': False, 'is_flying': False
    },
    {
        'name': 'storm_harpy',
        'src': os.path.join(BACKUP_DIR, 'storm_harpy.png'),
        'rows': 4, 'cols': 4, 'target_rows': 4, 'target_cols': 4,
        'is_white_bg': False, 'is_flying': True
    },
    {
        'name': 'pickups',
        'src': os.path.join(SPRITE_DIR, 'pickups.png'),
        'rows': 3, 'cols': 4, 'target_rows': 3, 'target_cols': 4,
        'is_white_bg': False, 'is_flying': False, 'is_pickup': True
    }
]

def clean_and_process_sheet(cfg):
    src_path = cfg['src']
    if not os.path.exists(src_path):
        print(f"[WARN] File not found: {src_path}")
        return None

    rows = cfg['rows']
    cols = cfg['cols']
    target_rows = cfg.get('target_rows', rows)
    target_cols = cfg.get('target_cols', cols)
    col_map = cfg.get('col_map', None)
    is_white_bg = cfg.get('is_white_bg', False)
    is_flying = cfg.get('is_flying', False)
    is_pickup = cfg.get('is_pickup', False)

    img = Image.open(src_path)
    arr = np.array(img.convert('RGBA'), dtype=np.float32)
    h, w = arr.shape[:2]
    cw, ch = w / cols, h / rows

    out_w, out_h = 1024, 1024
    out_cw, out_ch = out_w // target_cols, out_h // target_rows
    out_arr = np.zeros((out_h, out_w, 4), dtype=np.uint8)

    for r in range(min(rows, target_rows)):
        for out_c in range(target_cols):
            if col_map:
                src_c = col_map[out_c % len(col_map)]
            elif target_cols != cols:
                src_c = int(out_c * (cols / target_cols))
            else:
                src_c = out_c

            x0, x1 = int(src_c * cw), int((src_c + 1) * cw)
            y0, y1 = int(r * ch), int((r + 1) * ch)

            cell = arr[y0:y1, x0:x1].copy()
            cr, cg, cb = cell[:,:,0], cell[:,:,1], cell[:,:,2]

            # 1. Background Keying
            is_mag = (cr > 115) & (cb > 115) & (cg < 110) & (np.abs(cr - cb) < 75) & ((cr - cg) > 30) & ((cb - cg) > 30)
            is_white = ((cr > 195) & (cg > 195) & (cb > 195) & (np.abs(cr - cg) < 28) & (np.abs(cg - cb) < 28)) if is_white_bg else False
            is_dark = (cr < 28) & (cg < 28) & (cb < 28)

            src_alpha = cell[:,:,3] if cell.shape[2] == 4 else np.full(cell.shape[:2], 255.0)
            alpha = np.where(is_mag | is_white | is_dark, 0.0, src_alpha)

            # 2. Despill magenta fringe around edges
            fringe_mag = (alpha > 0) & (cr > cg) & (cb > cg) & ((cr - cg) > 15) & ((cb - cg) > 15)
            despill = np.clip(np.minimum(cr - cg, cb - cg) * 0.85, 0, 255)
            cr[fringe_mag] -= despill[fringe_mag]
            cb[fringe_mag] -= despill[fringe_mag]

            cell_rgba = np.dstack([cr, cg, cb, alpha]).astype(np.uint8)

            # Find non-transparent bounding box
            ys, xs = np.where(cell_rgba[:,:,3] > 30)
            if len(ys) < 20:
                continue

            min_y, max_y = ys.min(), ys.max()
            min_x, max_x = xs.min(), xs.max()
            char_w = max_x - min_x + 1
            char_h = max_y - min_y + 1
            char_crop = cell_rgba[min_y:max_y+1, min_x:max_x+1]

            # Safe-zone proportional scaling: max 80% of cell dimensions to eliminate border clipping
            max_allowed_h = int(out_ch * (0.88 if is_pickup else 0.80))
            max_allowed_w = int(out_cw * (0.88 if is_pickup else 0.80))
            scale = min(max_allowed_h / char_h, max_allowed_w / char_w, 1.0)
            target_w = max(1, int(char_w * scale))
            target_h = max(1, int(char_h * scale))

            crop_img = Image.fromarray(char_crop, 'RGBA')
            resized = crop_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
            char_arr = np.array(resized)

            # Positioning: center horizontally, ground to baseline vertically
            off_x = (out_cw - target_w) // 2
            if is_flying or is_pickup:
                off_y = (out_ch - target_h) // 2
            else:
                # 4px baseline above bottom border
                off_y = (out_ch - 4) - target_h

            off_y = max(3, min(out_ch - target_h - 3, off_y))
            off_x = max(3, min(out_cw - target_w - 3, off_x))

            out_cell = np.zeros((out_ch, out_cw, 4), dtype=np.uint8)
            out_cell[off_y:off_y+target_h, off_x:off_x+target_w] = char_arr

            # Enforce 3px guaranteed transparent border around every single cell
            out_cell[:3, :, 3] = 0
            out_cell[-3:, :, 3] = 0
            out_cell[:, :3, 3] = 0
            out_cell[:, -3:, 3] = 0

            out_arr[r*out_ch:(r+1)*out_ch, out_c*out_cw:(out_c+1)*out_cw] = out_cell

    return Image.fromarray(out_arr, 'RGBA')

def main():
    os.makedirs(BACKUP_DIR, exist_ok=True)
    print("=== Reprocessing All 15 Sprite Sheets with Safe-Zone Margins & Baseline Grounding ===")
    for cfg in SHEET_CONFIGS:
        name = cfg['name']
        dst = os.path.join(SPRITE_DIR, f"{name}.png")
        backup = os.path.join(BACKUP_DIR, f"{name}.png")

        if os.path.exists(dst) and not os.path.exists(backup):
            shutil.copy2(dst, backup)

        processed = clean_and_process_sheet(cfg)
        if processed:
            processed.save(dst, 'PNG')
            arr = np.array(processed)
            alpha = arr[:,:,3]
            mean_a = alpha.mean()
            print(f"[OK] {name:15s}: saved ({processed.size[0]}x{processed.size[1]}) mean_alpha={mean_a:5.1f}")
        else:
            print(f"[FAIL] {name:15s}: failed to process")

if __name__ == '__main__':
    main()
