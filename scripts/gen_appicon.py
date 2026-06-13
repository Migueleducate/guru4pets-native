#!/usr/bin/env python3
"""Generate a complete, alpha-free iOS AppIcon set from the source icon.

Fixes Apple validation error:
  "Invalid large app icon. The large app icon ... can't be transparent or
   contain an alpha channel."

What it does:
  1. Loads the source 1024x1024 icon (RGBA, has transparent rounded corners).
  2. Composites it over the dominant solid background color, squaring the
     corners and removing the alpha channel entirely (RGB output).
  3. Renders every size iOS expects and writes a matching Contents.json.
  4. All output PNGs are fully opaque RGB (no alpha channel).
"""
import os
import json
from PIL import Image

SRC = "/home/ubuntu/Uploads/AppIcon-512@2x.png"
OUT_DIR = os.path.join(
    os.path.dirname(__file__),
    "..", "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset",
)
OUT_DIR = os.path.abspath(OUT_DIR)
BG = (253, 116, 36)  # dominant solid orange detected from the source icon

# (size_pt, scale) entries for iOS. filename pattern: AppIcon-<px>x<px>[@Nx].png
# Each tuple: (idiom, size_pt_str, scale_str)
ENTRIES = [
    ("iphone", "20x20", "2x"),
    ("iphone", "20x20", "3x"),
    ("iphone", "29x29", "2x"),
    ("iphone", "29x29", "3x"),
    ("iphone", "40x40", "2x"),
    ("iphone", "40x40", "3x"),
    ("iphone", "60x60", "2x"),
    ("iphone", "60x60", "3x"),
    ("ipad", "20x20", "1x"),
    ("ipad", "20x20", "2x"),
    ("ipad", "29x29", "1x"),
    ("ipad", "29x29", "2x"),
    ("ipad", "40x40", "1x"),
    ("ipad", "40x40", "2x"),
    ("ipad", "76x76", "1x"),
    ("ipad", "76x76", "2x"),
    ("ipad", "83.5x83.5", "2x"),
    ("ios-marketing", "1024x1024", "1x"),
]


def flatten(src_img):
    """Composite RGBA over solid BG -> opaque RGB, squared corners."""
    rgba = src_img.convert("RGBA")
    bg = Image.new("RGB", rgba.size, BG)
    bg.paste(rgba, mask=rgba.split()[3])  # use alpha as paste mask
    return bg  # RGB, no alpha


def px_for(size_pt, scale):
    base = float(size_pt.split("x")[0])
    mult = int(scale.replace("x", ""))
    return int(round(base * mult))


def main():
    src = Image.open(SRC)
    flat = flatten(src)

    os.makedirs(OUT_DIR, exist_ok=True)
    # Clean out old png files in the appiconset.
    for f in os.listdir(OUT_DIR):
        if f.lower().endswith(".png"):
            os.remove(os.path.join(OUT_DIR, f))

    images = []
    written = {}
    for idiom, size_pt, scale in ENTRIES:
        px = px_for(size_pt, scale)
        filename = f"AppIcon-{px}.png"
        # Reuse a file if the same pixel size was already generated.
        if px not in written:
            img = flat.resize((px, px), Image.LANCZOS).convert("RGB")
            img.save(os.path.join(OUT_DIR, filename), format="PNG")
            written[px] = filename
        images.append({
            "filename": written[px],
            "idiom": idiom,
            "scale": scale,
            "size": size_pt,
        })

    contents = {"images": images, "info": {"author": "xcode", "version": 1}}
    with open(os.path.join(OUT_DIR, "Contents.json"), "w") as fh:
        json.dump(contents, fh, indent=2)

    print(f"Wrote {len(written)} unique PNG sizes to {OUT_DIR}")


if __name__ == "__main__":
    main()
