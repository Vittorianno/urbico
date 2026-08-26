from pathlib import Path

from PIL import Image


ICON_PATHS = [
    Path("assets/images/icon.png"),
    Path("assets/images/splash-icon.png"),
    Path("assets/images/favicon.png"),
    Path("assets/images/android-icon-foreground.png"),
]


def optimize_icon(path: Path) -> None:
    with Image.open(path) as source:
        image = source.convert("RGBA")
        image.thumbnail((512, 512), Image.Resampling.LANCZOS)
        image.save(path, format="PNG", optimize=True, compress_level=9)


for icon_path in ICON_PATHS:
    optimize_icon(icon_path)
    print(f"optimized {icon_path}")
