"""Builds the Graass Studio icon pack (svg, ico, png, manifest) from one blade design.

Run from the repo root:  python tools/make_icons.py
"""
import json
import math
import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "icons")
S = 1024  # design canvas

# colors match the default Meadow palette
BG_TOP, BG_BOTTOM = (16, 102, 84), (4, 52, 45)
BLADES = [
    # base x, height, bend (rad), width, tip color, root color
    (210, 700, 1.00, 200, (64, 182, 124), (6, 70, 58)),
    (420, 860, 0.78, 240, (184, 246, 112), (20, 128, 98)),
    (600, 640, 1.10, 190, (118, 218, 118), (10, 96, 78)),
]
BASE_Y = 1010  # just below the tile, so blades grow out of the edge


def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def blade_points(bx, h, bend, w, scale=1.0, ox=0.0, oy=0.0, steps=28):
    """Same constant-curvature arc and leaf width as the grass shader, seen from the side."""
    left, right = [], []
    for i in range(steps + 1):
        t = i / steps
        a = bend * t
        x = bx + h * (1 - math.cos(a)) / bend
        y = BASE_Y - h * math.sin(a) / bend
        nx, ny = math.cos(a), math.sin(a)  # normal to the curve (image coords)
        hw = 0.5 * w * (1 - t) ** 0.9 * (0.7 + 0.3 * smooth(0, 0.25, t))
        left.append((x - nx * hw, y - ny * hw))
        right.append((x + nx * hw, y + ny * hw))
    pts = left + right[::-1]
    return [(ox + px * scale, oy + py * scale) for px, py in pts]


def art_transform(full_bleed):
    # maskable icons keep the art inside the 80% safe zone
    return (0.8, S * 0.1, S * 0.1) if full_bleed else (1.0, 0.0, 0.0)


def vgrad(size, top, bottom):
    g = Image.new("RGB", (1, 256))
    for y in range(256):
        k = y / 255
        g.putpixel((0, y), tuple(round(top[i] + (bottom[i] - top[i]) * k) for i in range(3)))
    return g.resize(size, Image.BILINEAR)


def render(size, rounded=True, full_bleed=False):
    big = S * 2  # supersample for smooth edges
    f = big / S
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))

    # background tile
    bg = vgrad((big, big), BG_TOP, BG_BOTTOM).convert("RGBA")
    mask = Image.new("L", (big, big), 0)
    if rounded:
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, big - 1, big - 1), radius=int(big * 0.225), fill=255)
    else:
        mask.paint = None
        ImageDraw.Draw(mask).rectangle((0, 0, big, big), fill=255)
    # soft sun glow, upper right
    glow = Image.new("L", (big, big), 0)
    ImageDraw.Draw(glow).ellipse((big * 0.55, big * 0.02, big * 1.05, big * 0.52), fill=120)
    glow = glow.filter(ImageFilter.GaussianBlur(big * 0.08))
    bg = Image.composite(Image.new("RGBA", (big, big), (190, 245, 150, 255)), bg, glow.point(lambda v: v * 0.45))
    img.paste(bg, (0, 0), mask)

    sc, ox, oy = art_transform(full_bleed)
    for bx, h, bend, w, tip, root in BLADES:
        pts = blade_points(bx, h, bend, w, sc * f, ox * f, oy * f)
        bmask = Image.new("L", (big, big), 0)
        ImageDraw.Draw(bmask).polygon(pts, fill=255)
        bmask = Image.composite(bmask, Image.new("L", (big, big), 0), mask)
        top_y = min(p[1] for p in pts)
        bot_y = max(p[1] for p in pts)
        grad = Image.new("RGBA", (big, big), root + (255,))
        span = vgrad((big, max(1, int(bot_y - top_y))), tip, root).convert("RGBA")
        grad.paste(span, (0, int(top_y)))
        img.paste(grad, (0, 0), bmask)

    return img.resize((size, size), Image.LANCZOS)


def svg(full_bleed=False, rounded=True):
    sc, ox, oy = art_transform(full_bleed)
    rx = S * 0.225 if rounded else 0
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}">', "<defs>",
           f'<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb{BG_TOP}"/><stop offset="1" stop-color="rgb{BG_BOTTOM}"/></linearGradient>',
           '<radialGradient id="sun" cx="0.78" cy="0.26" r="0.38"><stop offset="0" stop-color="#bef596" stop-opacity="0.32"/><stop offset="1" stop-color="#bef596" stop-opacity="0"/></radialGradient>']
    paths = []
    for i, (bx, h, bend, w, tip, root) in enumerate(BLADES):
        pts = blade_points(bx, h, bend, w, sc, ox, oy)
        ys = [p[1] for p in pts]
        out.append(f'<linearGradient id="b{i}" gradientUnits="userSpaceOnUse" x1="0" y1="{min(ys):.0f}" x2="0" y2="{max(ys):.0f}">'
                   f'<stop offset="0" stop-color="rgb{tip}"/><stop offset="1" stop-color="rgb{root}"/></linearGradient>')
        d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + " Z"
        paths.append(f'<path d="{d}" fill="url(#b{i})"/>')
    out.append("</defs>")
    out.append(f'<clipPath id="tile"><rect width="{S}" height="{S}" rx="{rx:.0f}"/></clipPath>')
    out.append('<g clip-path="url(#tile)">')
    out.append(f'<rect width="{S}" height="{S}" fill="url(#bg)"/><rect width="{S}" height="{S}" fill="url(#sun)"/>')
    out.extend(paths)
    out.append("</g></svg>")
    return "\n".join(out)


def main():
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "icon.svg"), "w", encoding="utf-8") as f:
        f.write(svg())
    with open(os.path.join(OUT, "icon-maskable.svg"), "w", encoding="utf-8") as f:
        f.write(svg(full_bleed=True, rounded=False))

    for size in (16, 32, 48, 64, 128, 192, 256, 512, 1024):
        render(size).save(os.path.join(OUT, f"icon-{size}.png"))
    render(512, rounded=False, full_bleed=True).save(os.path.join(OUT, "icon-maskable-512.png"))
    render(180, rounded=False).convert("RGB").save(os.path.join(OUT, "apple-touch-icon.png"))

    # favicon.ico with the small sizes browsers and Windows use
    render(256).save(os.path.join(ROOT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

    manifest = {
        "name": "Graass Studio",
        "short_name": "Graass",
        "description": "Stylized GPU grass field with steerable wind, colors, light and camera.",
        "start_url": "./",
        "display": "standalone",
        "background_color": "#0f6654",
        "theme_color": "#0f6654",
        "icons": [
            {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
            {"src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
            {"src": "icons/icon.svg", "sizes": "any", "type": "image/svg+xml"},
        ],
    }
    with open(os.path.join(ROOT, "site.webmanifest"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
