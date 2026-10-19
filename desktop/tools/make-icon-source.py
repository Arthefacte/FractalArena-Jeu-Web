"""Fabrique une source d'icone carree, detouree et cadree serre, pour `tauri icon`.

Entree  : assets/pwa/icon-512.png (hexagone sur fond transparent)
Sortie  : PNG 1024x1024, hexagone a ~96 % de la largeur, coins transparents.

Usage : uv run --with pillow python tools/make-icon-source.py <src.png> <out.png>
"""
import sys
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGBA")

# cadrer sur le contenu reel (les PNG de la PWA gardent 9 % de marge)
bbox = im.split()[3].getbbox()
if bbox:
    im = im.crop(bbox)

# reposer sur un carre 1024 avec 2 % de respiration
side = max(im.size)
margin = round(side * 0.02)
canvas = Image.new("RGBA", (side + 2 * margin, side + 2 * margin), (0, 0, 0, 0))
canvas.paste(im, ((canvas.width - im.width) // 2, (canvas.height - im.height) // 2), im)
canvas = canvas.resize((1024, 1024), Image.Resampling.LANCZOS)
canvas.save(out)
print(f"{out}  {canvas.size}  contenu={100 - 4:.0f}%")
