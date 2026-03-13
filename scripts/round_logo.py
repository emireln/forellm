#!/usr/bin/env python3
"""
Enlarge logo (crop padding), then apply rounded corners.
Requires: pip install Pillow
Run from repo root:
  python scripts/round_logo.py                     # uses forellm-original.png or assets/icon.png
  python scripts/round_logo.py forellm-original.png  # use a specific filename
"""
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Install Pillow: pip install Pillow", file=sys.stderr)
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parent.parent
ASSETS = REPO_ROOT / "assets"

SIZE = 2048  # main logo size (keeps taskbar/window icon sharp)
FAVICON_SIZE = 192  # favicon size (crisp when scaled; not oversized)
# Keep center portion: less aggressive so logo isn't squashed at the sides
CROP_FACTOR = 0.70  # 70% width & height — balanced size without horizontal squeeze
CORNER_RADIUS = 384  # rounded corners in px (scaled with SIZE)


def add_rounded_corners(im, radius):
    """Composite image with a rounded-rectangle mask."""
    mask = Image.new("L", im.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), im.size], radius=radius, fill=255)
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, mask=mask)
    return out


def main():
    if len(sys.argv) >= 2:
        name = sys.argv[1]
        input_path = (REPO_ROOT / name) if (REPO_ROOT / name).exists() else (ASSETS / name)
    else:
        # Default: repo root forellm-original.png, then assets/forellm-original.png, then assets/icon.png
        for candidate in [REPO_ROOT / "forellm-original.png", ASSETS / "forellm-original.png", ASSETS / "icon.png"]:
            if candidate.exists():
                input_path = candidate
                break
        else:
            print("Error: no logo found (forellm-original.png or assets/icon.png)", file=sys.stderr)
            sys.exit(1)
    if not input_path.exists():
        print(f"Error: {input_path} not found", file=sys.stderr)
        sys.exit(1)
    output_path = input_path

    img = Image.open(input_path).convert("RGBA")
    w, h = img.size

    crop_w = int(w * CROP_FACTOR)
    crop_h = int(h * CROP_FACTOR)
    left = (w - crop_w) // 2
    top = (h - crop_h) // 2

    cropped = img.crop((left, top, left + crop_w, top + crop_h))
    resized = cropped.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    rounded = add_rounded_corners(resized, CORNER_RADIUS)
    rounded.save(output_path, "PNG")
    print("Written:", output_path)

    # Write a smaller favicon to forellm-gui/public/ for crisp in-app tab icon
    if output_path.name == "forellm-original.png":
        public_dir = REPO_ROOT / "forellm-gui" / "public"
        public_dir.mkdir(parents=True, exist_ok=True)
        favicon_path = public_dir / "forellm-original.png"
        favicon = rounded.resize((FAVICON_SIZE, FAVICON_SIZE), Image.Resampling.LANCZOS)
        favicon.save(favicon_path, "PNG")
        print("Written (favicon):", favicon_path)


if __name__ == "__main__":
    main()
