"""Re-read Transaction History table fields and sample rows."""
import json, sys
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


def post(u, p):
    r = Request(u, data=json.dumps(p).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
    return json.loads(urlopen(r).read())


def get(u, h):
    return json.loads(urlopen(Request(u, headers=h, method="GET")).read())


e = env()
tok = post(f"{HOST}/open-apis/auth/v3/tenant_access_token/internal", {"app_id": e["LARK_APP_ID"], "app_secret": e["LARK_APP_SECRET"]})["tenant_access_token"]
auth = {"Authorization": f"Bearer {tok}"}
base = e["LARK_BASE_ID"]

print("=== FIELDS ===")
for f in get(f"{HOST}/open-apis/bitable/v1/apps/{base}/tables/{TXN}/fields?page_size=100", auth)["data"]["items"]:
    print(f"  {f['field_name']:<25} type={f.get('ui_type') or f.get('type')}  id={f['field_id']}")

print("\n=== 3 SAMPLE ROWS ===")
for it in get(f"{HOST}/open-apis/bitable/v1/apps/{base}/tables/{TXN}/records?page_size=3", auth)["data"]["items"]:
    print(f"\n{it['record_id']}")
    for k, v in it["fields"].items():
        print(f"  {k}: {v}")
