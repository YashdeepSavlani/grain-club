"""Draw the home-screen icons into site/ and the iPhone app icon. Run: python3 tools/make_icons.py"""
import pathlib, random
from PIL import Image, ImageDraw, ImageFilter
out = pathlib.Path(__file__).resolve().parent.parent / "site"
S = 1024
def icon():
    im = Image.new("RGB", (S, S), (10, 10, 11))
    d = ImageDraw.Draw(im)
    c = S // 2
    # lens: cream barrel, dark glass, amber date-stamp light
    for r, col in [(352, (246, 243, 236)), (318, (22, 22, 24)), (300, (36, 34, 40)), (236, (14, 14, 16))]:
        d.ellipse([c - r, c - r, c + r, c + r], fill=col)
    glass = Image.new("L", (S, S), 0); g = ImageDraw.Draw(glass)
    g.ellipse([c - 236, c - 236, c + 236, c + 236], fill=255)
    tint = Image.new("RGB", (S, S), (0, 0, 0)); t = ImageDraw.Draw(tint)
    for i in range(236, 0, -4):   # soft blue-violet glass gradient
        k = i / 236
        t.ellipse([c - i, c - i - 30 * (1 - k), c + i, c + i - 30 * (1 - k)], fill=(int(30 + 30 * (1 - k)), int(26 + 18 * (1 - k)), int(44 + 60 * (1 - k))))
    im.paste(tint, (0, 0), glass)
    hl = Image.new("RGB", (S, S), (0, 0, 0)); h = ImageDraw.Draw(hl)
    h.ellipse([c - 150, c - 170, c - 40, c - 60], fill=(255, 178, 36))
    hl = hl.filter(ImageFilter.GaussianBlur(26))
    from PIL import ImageChops
    im = ImageChops.add(im, hl)
    d = ImageDraw.Draw(im)
    d.ellipse([c - 118, c - 138, c - 72, c - 92], fill=(255, 214, 120))
    # film grain
    random.seed(7)
    px = im.load()
    for _ in range(S * S // 6):
        x, y = random.randrange(S), random.randrange(S); n = random.randint(-14, 14)
        r, g2, b = px[x, y]; px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g2 + n)), max(0, min(255, b + n)))
    return im
big = icon()
for n in (180, 192, 512):
    big.resize((n, n), Image.LANCZOS).save(out / f"icon-{n}.png", optimize=True)
ios = out.parent / "ios/GrainClub/Assets.xcassets/AppIcon.appiconset"
if ios.is_dir():
    big.save(ios / "icon-1024.png", optimize=True)
print("icons written to", out)
