#!/usr/bin/env python3
"""
Enlarge logo (crop padding), then apply rounded corners.
Requires: pip install Pillow
Run from repo root: python scripts/round_logo.py
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
INPUT_PATH = ASSETS / "icon.png"
OUTPUT_PATH = ASSETS / "icon.png"

SIZE = 512
CROP_FACTOR = 0.58  # keep center 58% -> logo appears bigger, less side space
CORNER_RADIUS = 96  # rounded corners in px


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
    img = Image.open(INPUT_PATH).convert("RGBA")
    w, h = img.size

    crop_w = int(w * CROP_FACTOR)
    crop_h = int(h * CROP_FACTOR)
    left = (w - crop_w) // 2
    top = (h - crop_h) // 2

    cropped = img.crop((left, top, left + crop_w, top + crop_h))
    resized = cropped.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    rounded = add_rounded_corners(resized, CORNER_RADIUS)
    rounded.save(OUTPUT_PATH, "PNG")
    print("Written:", OUTPUT_PATH)


if __name__ == "__main__":
    main()
