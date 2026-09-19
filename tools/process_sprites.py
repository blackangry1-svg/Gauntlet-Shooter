import os
import numpy as np
from PIL import Image

SHEET_CONFIGS = {
    'death_bat': {'rows': 6, 'cols': 4, 'has_labels': False},
    'death_knight': {'rows': 3, 'cols': 6, 'has_labels': False},
    'orc_grunt': {'rows': 6, 'cols': 6, 'has_labels': True},
    'skeleton_archer': {'rows': 6, 'cols': 6, 'has_labels': False},
    'stone_golem': {'rows': 4, 'cols': 4, 'has_labels': False},
    'warrior': {'rows': 6, 'cols': 6, 'has_labels': False},
}

def remove_magenta_key(img, has_labels=False, rows=6, cols=6):
    arr = np.array(img.convert('RGBA'), dtype=np.float32)
    h, w = arr.shape[:2]
    r, g, b, a = arr[:,:,0], arr[:,:,1], arr[:,:,2], arr[:,:,3]
    
    # Detect magenta: R and B are high, G is noticeably lower
    is_magenta = (r > 130) & (b > 130) & (g < 110) & (abs(r - b) < 65) & ((r - g) > 50) & ((b - g) > 50)
    
    # Edge fringe detection & despill
    fringe = (~is_magenta) & (r > g) & (b > g) & ((r - g) > 25) & ((b - g) > 25)
    despill = np.clip(np.minimum(r - g, b - g) * 0.75, 0, 255)
    r[fringe] -= despill[fringe]
    b[fringe] -= despill[fringe]
    
    alpha = np.where(is_magenta, 0.0, 255.0)
    
    # If the sheet has cell numbers and border lines (like orc_grunt), clear cell borders and number badges
    if has_labels:
        cell_w = w / cols
        cell_h = h / rows
        for row in range(rows):
            for col in range(cols):
                cx0 = int(col * cell_w)
                cy0 = int(row * cell_h)
                cx1 = int((col + 1) * cell_w)
                cy1 = int((row + 1) * cell_h)
                
                # Clear 1px cell borders
                alpha[cy0:cy0+2, cx0:cx1] = 0.0
                alpha[cy1-2:cy1, cx0:cx1] = 0.0
                alpha[cy0:cy1, cx0:cx0+2] = 0.0
                alpha[cy0:cy1, cx1-2:cx1] = 0.0
                
                # Clear top-left label area (numbers 1-24)
                # Labels are small numbers in the top-left 25x20 region of each cell
                lbl_w = min(28, int(cell_w * 0.2))
                lbl_h = min(22, int(cell_h * 0.2))
                # Check if this top-left box contains a disconnected digit (character head is below)
                alpha[cy0:cy0+lbl_h, cx0:cx0+lbl_w] = 0.0

    arr[:,:,0] = np.clip(r, 0, 255)
    arr[:,:,1] = np.clip(g, 0, 255)
    arr[:,:,2] = np.clip(b, 0, 255)
    arr[:,:,3] = alpha
    
    return Image.fromarray(arr.astype(np.uint8), 'RGBA')

def main():
    base_dir = r'C:\Users\pdard\OneDrive\Desktop\voxel games\gauntlet legends\Gauntlet Shooter\assets\sprites'
    for name, cfg in SHEET_CONFIGS.items():
        src = os.path.join(base_dir, f'{name}.jpg')
        dst = os.path.join(base_dir, f'{name}.png')
        if not os.path.exists(src):
            print(f'Skipping {name}, not found')
            continue
        img = Image.open(src)
        keyed = remove_magenta_key(img, has_labels=cfg['has_labels'], rows=cfg['rows'], cols=cfg['cols'])
        keyed.save(dst, 'PNG')
        print(f'Successfully keyed and saved: {dst} ({keyed.size}, RGBA)')

if __name__ == '__main__':
    main()
