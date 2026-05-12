"""Delete a transaction by its record_id (cleanup of test data)."""
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


if len(sys.argv) != 2:
    print("Usage: delete_test_txn.py <record_id>")
    sys.exit(1)

rec = sys.argv[1]
e = env()
tok = json.loads(urlopen(Request(
    f"{HOST}/open-apis/auth/v3/tenant_access_token/internal",
    data=json.dumps({"app_id": e["LARK_APP_ID"], "app_secret": e["LARK_APP_SECRET"]}).encode(),
    headers={"Content-Type": "application/json"}, method="POST",
)).read())["tenant_access_token"]

r = Request(
    f"{HOST}/open-apis/bitable/v1/apps/{e['LARK_BASE_ID']}/tables/{TXN}/records/{rec}",
    headers={"Authorization": f"Bearer {tok}"},
    method="DELETE",
)
resp = json.loads(urlopen(r).read())
print(json.dumps(resp))
