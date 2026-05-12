"""Generate a QR PNG per manager, pointing to {BASE_URL}/m/{record_id}.

Usage:
    python scripts/generate_qrs.py                 # uses APP_BASE_URL from .env.local
    python scripts/generate_qrs.py <base_url>      # override (e.g. http://192.168.0.104:3000)

Output: qr/<Name>.png — high-error-correction, large enough to print on a card.
Also writes qr/_index.csv (name, record_id, url, file).
"""
import csv
import json
import re
import sys
from pathlib import Path
from urllib.request import Request, urlopen

import qrcode

ROOT = Path(__file__).resolve().parent.parent
ENV = ROOT / ".env.local"
OUT = ROOT / "qr"
HOST = "https://open.larksuite.com"
MASTER = "tblhhsgGkvjFqVzM"


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
    if isinstance(v, str):
        return v.strip()
    return str(v or "")


def slug(name: str) -> str:
    s = re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_")
    return s or "unknown"


def main():
    e = env()
    base_url = sys.argv[1] if len(sys.argv) > 1 else e.get("APP_BASE_URL", "http://localhost:3000")
    base_url = base_url.rstrip("/")
    print(f"Base URL: {base_url}")

    tok = json.loads(urlopen(Request(
        f"{HOST}/open-apis/auth/v3/tenant_access_token/internal",
        data=json.dumps({"app_id": e["LARK_APP_ID"], "app_secret": e["LARK_APP_SECRET"]}).encode(),
        headers={"Content-Type": "application/json"}, method="POST",
    )).read())["tenant_access_token"]

    r = json.loads(urlopen(Request(
        f"{HOST}/open-apis/bitable/v1/apps/{e['LARK_BASE_ID']}/tables/{MASTER}/records?page_size=500",
        headers={"Authorization": f"Bearer {tok}"}, method="GET",
    )).read())

    managers = []
    for it in r["data"]["items"]:
        name = cell(it["fields"].get("Name"))
        position = cell(it["fields"].get("Position"))
        managers.append((name, position, it["record_id"]))
    managers.sort(key=lambda x: x[0])

    OUT.mkdir(exist_ok=True)
    index_rows = []

    for name, position, rec in managers:
        url = f"{base_url}/m/{rec}"
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=12,
            border=2,
        )
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#1A0000", back_color="#FFFFFF")
        filename = OUT / f"{slug(name)}.png"
        img.save(filename)
        index_rows.append({"name": name, "position": position, "record_id": rec, "url": url, "file": filename.name})
        print(f"  {name:<32} -> {filename.name}")

    index_path = OUT / "_index.csv"
    with index_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["name", "position", "record_id", "url", "file"])
        w.writeheader()
        w.writerows(index_rows)

    print(f"\nGenerated {len(managers)} QR PNGs in: {OUT}")
    print(f"Index:  {index_path}")


if __name__ == "__main__":
    main()
