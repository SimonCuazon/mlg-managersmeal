"""Dump the Manager field's raw value for a few rows to understand its shape."""
import json
from pathlib import Path
from urllib.request import Request, urlopen

ENV = Path(__file__).resolve().parent.parent / ".env.local"
HOST = "https://open.larksuite.com"
TXN = "tblVkJV8f3RCY8xi"


def env():
    d = {}
    for ln in ENV.read_text(encoding="utf-8").splitlines():
        ln = ln.strip()
        if ln and not ln.startswith("#") and "=" in ln:
            k, v = ln.split("=", 1)
            d[k.strip()] = v.strip()
    return d


e = env()
tok = json.loads(urlopen(Request(
    f"{HOST}/open-apis/auth/v3/tenant_access_token/internal",
    data=json.dumps({"app_id": e["LARK_APP_ID"], "app_secret": e["LARK_APP_SECRET"]}).encode(),
    headers={"Content-Type": "application/json"}, method="POST",
)).read())["tenant_access_token"]

r = json.loads(urlopen(Request(
    f"{HOST}/open-apis/bitable/v1/apps/{e['LARK_BASE_ID']}/tables/{TXN}/records?page_size=5",
    headers={"Authorization": f"Bearer {tok}"}, method="GET",
)).read())

for it in r["data"]["items"]:
    print(f"\nrecord_id={it['record_id']}")
    print(f"  Name = {it['fields'].get('Name')!r}")
    print(f"  Manager = {it['fields'].get('Manager')!r}")
