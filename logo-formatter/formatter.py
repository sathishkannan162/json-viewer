#!/usr/bin/env python3
"""
Convert logo-formatter/json-viewer.png to all icon formats used in src-tauri/icons.
Requires: pip install Pillow
"""

import os
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Install Pillow: pip install Pillow", file=sys.stderr)
    sys.exit(1)

# Paths relative to this script
SCRIPT_DIR = Path(__file__).resolve().parent
SOURCE_IMAGE = SCRIPT_DIR / "json-viewer.png"
OUTPUT_DIR = SCRIPT_DIR.parent / "src-tauri" / "icons"

# PNG sizes to generate (filename -> (width, height))
PNG_OUTPUTS = {
    "32x32.png": (32, 32),
    "128x128.png": (128, 128),
    "128x128@2x.png": (256, 256),
    "icon.png": (512, 512),
    "Square30x30Logo.png": (30, 30),
    "Square44x44Logo.png": (44, 44),
    "Square71x71Logo.png": (71, 71),
    "Square89x89Logo.png": (89, 89),
    "Square107x107Logo.png": (107, 107),
    "Square142x142Logo.png": (142, 142),
    "Square150x150Logo.png": (150, 150),
    "Square284x284Logo.png": (284, 284),
    "Square310x310Logo.png": (310, 310),
    "StoreLogo.png": (50, 50),
}


def resize_image(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Resize image with high-quality Lanczos resampling."""
    return img.resize(size, Image.Resampling.LANCZOS)


def ensure_rgba(img: Image.Image) -> Image.Image:
    """Convert to RGBA if needed (for PNG with transparency)."""
    if img.mode != "RGBA":
        return img.convert("RGBA")
    return img


def main() -> None:
    if not SOURCE_IMAGE.exists():
        print(f"Source image not found: {SOURCE_IMAGE}", file=sys.stderr)
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    img = Image.open(SOURCE_IMAGE).copy()
    img = ensure_rgba(img)

    # Generate all PNGs
    for name, size in PNG_OUTPUTS.items():
        out_path = OUTPUT_DIR / name
        resized = resize_image(img, size)
        resized.save(out_path, "PNG")
        print(f"Wrote {out_path}")

    # Generate icon.ico (multi-size for Windows)
    ico_sizes = [(16, 16), (32, 32), (48, 48), (256, 256)]
    ico_path = OUTPUT_DIR / "icon.ico"
    img.save(ico_path, format="ICO", sizes=ico_sizes)
    print(f"Wrote {ico_path}")

    # Generate icon.icns on macOS using iconutil
    if sys.platform == "darwin":
        icns_sizes = [
            (16, 16),
            (32, 32),
            (64, 64),
            (128, 128),
            (256, 256),
            (512, 512),
        ]
        with tempfile.TemporaryDirectory() as tmpdir:
            iconset = Path(tmpdir) / "icon.iconset"
            iconset.mkdir()
            # iconutil expects: icon_16x16.png, icon_16x16@2x.png, etc.
            for w, h in icns_sizes:
                resized = resize_image(img, (w, h))
                resized.save(iconset / f"icon_{w}x{h}.png", "PNG")
                if w <= 256:  # @2x variants for 16,32,128,256
                    resized_2x = resize_image(img, (w * 2, h * 2))
                    resized_2x.save(iconset / f"icon_{w}x{h}@2x.png", "PNG")
            subprocess.run(
                ["iconutil", "-c", "icns", str(iconset), "-o", str(OUTPUT_DIR / "icon.icns")],
                check=True,
            )
        print(f"Wrote {OUTPUT_DIR / 'icon.icns'}")
    else:
        print("Skipping icon.icns (macOS only; run this script on macOS to generate it)")

    print("Done.")


if __name__ == "__main__":
    main()
