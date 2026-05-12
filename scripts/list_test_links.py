"""List all manager test URLs for localhost."""
import json, sys
from pathlib import Path
from urllib.request import Request, urlopen

ENV = Path(__file__).resolve().parent.parent / ".env.local"
HOST = "https://open.larksuite.com"
MASTER = "tblhhsgGkvjFqVzM"
BASE_URL = "http://localhost:3000"


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


e = env()
tok = json.loads(urlopen(Request(
    f"{HOST}/open-apis/auth/v3/tenant_access_token/internal",
    data=json.dumps({"app_id": e["LARK_APP_ID"], "app_secret": e["LARK_APP_SECRET"]}).encode(),
    headers={"Content-Type": "application/json"}, method="POST",
)).read())["tenant_access_token"]

r = json.loads(urlopen(Request(
    f"{HOST}/open-apis/bitable/v1/apps/{e['LARK_BASE_ID']}/tables/{MASTER}/records?page_size=500",
    headers={"Authorization": f"Bearer {tok}"}, method="GET",
)).read())

rows = []
for it in r["data"]["items"]:
    f = it["fields"]
    rows.append({
        "name": cell(f.get("Name")),
        "position": cell(f.get("Position")) or "—",
        "credit": f.get("Credit"),
        "record_id": it["record_id"],
    })
rows.sort(key=lambda x: x["name"])

print(f"{'NAME':<32} {'POSITION':<22} {'CREDIT':>9}  URL")
print("-" * 110)
for r in rows:
    credit = f"{r['credit']:>9,.0f}" if isinstance(r["credit"], (int, float)) else "         "
    print(f"{r['name']:<32} {r['position']:<22} {credit}  {BASE_URL}/m/{r['record_id']}")
