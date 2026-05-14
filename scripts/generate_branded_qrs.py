"""Generate MLG-branded QR cards (red corners, espresso text, wordmark).

Mirrors the layout of the existing Jocelyn Panadero card: portrait, red angled
corners top-left + bottom-right, black corners top-right + bottom-left, large QR
in the upper-middle, name in bold below, position in grey, 'mlg HOSPITALITY'
wordmark bottom-right.

If a logo file exists at assets/mlg-logo.png it replaces the text wordmark.

Usage:
    python scripts/generate_branded_qrs.py                 # uses APP_BASE_URL
    python scripts/generate_branded_qrs.py <base_url>      # override

Output: qr_cards/<Name>.png
"""
import json
import re
import sys
from pathlib import Path
from urllib.request import Request, urlopen

import qrcode
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ENV = ROOT / ".env.local"
OUT = ROOT / "qr_cards"
LOGO_PATH = ROOT / "assets" / "mlg-logo.png"
HOST = "https://open.larksuite.com"
MASTER = "tblhhsgGkvjFqVzM"

# Card dimensions — portrait, ~A6 aspect ratio at 300dpi printable
CARD_W = 810
CARD_H = 1200
TRI_SIZE = 220          # size of the corner triangles
RED = (139, 0, 0)       # #8B0000 (MLG primary)
BLACK = (26, 0, 0)      # #1A0000 (espresso)
GREY = (102, 102, 102)  # #666
WHITE = (255, 255, 255)


def env():
    d = {}
    for ln in ENV.read_text(encoding="utf-8").splitlines():
        ln = ln.strip()
        if ln and not ln.startswith("#") and "=" in ln:
            k, v = ln.split("=", 1)
            d[k.strip()] = v.strip()
    return d


def cell(v):
    if isinstance(v, list):
        return "".join(p.get("text", "") for p in v if isinstance(p, dict)).strip()
    return (v or "").strip() if isinstance(v, str) else str(v or "")


def slug(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_") or "unknown"


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = (
        ["arialbd.ttf", "Arial Bold.ttf", "seguibl.ttf"] if bold else ["arial.ttf", "Arial.ttf", "segoeui.ttf"]
    )
    for fam in candidates:
        for base in [r"C:\Windows\Fonts", "/usr/share/fonts/truetype/dejavu", "/Library/Fonts"]:
            p = Path(base) / fam
            if p.exists():
                return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def make_qr(url: str, target_px: int) -> Image.Image:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=14,
        border=1,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color=BLACK, back_color=WHITE).convert("RGB")
    return img.resize((target_px, target_px), Image.NEAREST)


def draw_card(name: str, position: str, url: str) -> Image.Image:
    card = Image.new("RGB", (CARD_W, CARD_H), WHITE)
    d = ImageDraw.Draw(card)

    # Corner triangles — red top-left + bottom-right, black top-right + bottom-left
    d.polygon([(0, 0), (TRI_SIZE, 0), (0, TRI_SIZE)], fill=RED)
    d.polygon([(CARD_W, 0), (CARD_W, TRI_SIZE), (CARD_W - TRI_SIZE, 0)], fill=BLACK)
    d.polygon([(0, CARD_H), (0, CARD_H - TRI_SIZE), (TRI_SIZE, CARD_H)], fill=BLACK)
    d.polygon([(CARD_W, CARD_H), (CARD_W - TRI_SIZE, CARD_H), (CARD_W, CARD_H - TRI_SIZE)], fill=RED)

    # QR centered horizontally, upper-middle vertically
    qr_size = 520
    qr_x = (CARD_W - qr_size) // 2
    qr_y = 240
    qr_img = make_qr(url, qr_size)
    card.paste(qr_img, (qr_x, qr_y))

    # Manager name (bold, large)
    name_font = load_font(56, bold=True)
    name_w = d.textlength(name, font=name_font)
    name_y = qr_y + qr_size + 60
    d.text(((CARD_W - name_w) / 2, name_y), name, font=name_font, fill=BLACK)

    # Position (regular, grey)
    pos = position or ""
    if pos:
        pos_font = load_font(32, bold=False)
        pos_w = d.textlength(pos, font=pos_font)
        d.text(((CARD_W - pos_w) / 2, name_y + 80), pos, font=pos_font, fill=GREY)

    # Wordmark / logo bottom-right
    if LOGO_PATH.exists():
        logo = Image.open(LOGO_PATH).convert("RGBA")
        logo.thumbnail((180, 120))
        card.paste(logo, (CARD_W - logo.width - 60, CARD_H - logo.height - 60), logo)
    else:
        # Typographic fallback
        mlg_font = load_font(48, bold=True)
        sub_font = load_font(18, bold=True)
        mlg_text = "mlg"
        sub_text = "HOSPITALITY"
        mlg_w = d.textlength(mlg_text, font=mlg_font)
        sub_w = d.textlength(sub_text, font=sub_font)
        margin = 60
        mlg_x = CARD_W - max(mlg_w, sub_w) - margin
        mlg_y = CARD_H - 120
        d.text((mlg_x, mlg_y), mlg_text, font=mlg_font, fill=BLACK)
        d.text((mlg_x, mlg_y + 56), sub_text, font=sub_font, fill=BLACK)

    return card


def main():
    e = env()
    base_url = sys.argv[1] if len(sys.argv) > 1 else e.get("APP_BASE_URL", "http://localhost:3000")
    base_url = base_url.rstrip("/")
    print(f"Base URL: {base_url}")
    print(f"Logo: {'using ' + str(LOGO_PATH) if LOGO_PATH.exists() else 'text wordmark (no logo file at ' + str(LOGO_PATH) + ')'}")

    tok = json.loads(urlopen(Request(
        f"{HOST}/open-apis/auth/v3/tenant_access_token/internal",
        data=json.dumps({"app_id": e["LARK_APP_ID"], "app_secret": e["LARK_APP_SECRET"]}).encode(),
        headers={"Content-Type": "application/json"}, method="POST",
    )).read())["tenant_access_token"]

    r = json.loads(urlopen(Request(
        f"{HOST}/open-apis/bitable/v1/apps/{e['LARK_BASE_ID']}/tables/{MASTER}/records?page_size=500",
        headers={"Authorization": f"Bearer {tok}"}, method="GET",
    )).read())

    managers = sorted(
        [(cell(it["fields"].get("Name")), cell(it["fields"].get("Position")), it["record_id"])
         for it in r["data"]["items"]],
        key=lambda x: x[0],
    )

    OUT.mkdir(exist_ok=True)
    for name, position, rec in managers:
        url = f"{base_url}/m/{rec}"
        card = draw_card(name, position or "", url)
        path = OUT / f"{slug(name)}.png"
        card.save(path)
        print(f"  {name:<32} -> {path.name}")

    print(f"\nGenerated {len(managers)} cards in: {OUT}")


if __name__ == "__main__":
    main()
