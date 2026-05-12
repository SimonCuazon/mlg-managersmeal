"""Show all Master Records fields with full property details."""
import json
from pathlib import Path
from urllib.request import Request, urlopen

ENV = Path(__file__).resolve().parent.parent / ".env.local"
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


e = env()
tok = json.loads(urlopen(Request(
    f"{HOST}/open-apis/auth/v3/tenant_access_token/internal",
    data=json.dumps({"app_id": e["LARK_APP_ID"], "app_secret": e["LARK_APP_SECRET"]}).encode(),
    headers={"Content-Type": "application/json"}, method="POST",
)).read())["tenant_access_token"]

r = json.loads(urlopen(Request(
    f"{HOST}/open-apis/bitable/v1/apps/{e['LARK_BASE_ID']}/tables/{MASTER}/fields?page_size=100",
    headers={"Authorization": f"Bearer {tok}"}, method="GET",
)).read())

for f in r["data"]["items"]:
    print(f"\n{f['field_name']}  (id={f['field_id']}, type={f.get('type')}, ui_type={f.get('ui_type')})")
    print(f"  property: {json.dumps(f.get('property'), indent=4)}")
