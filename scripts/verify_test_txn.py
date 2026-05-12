"""Verify the test transaction landed in Lark and the Master Records rollup updated."""
import json, sys
from pathlib import Path
from urllib.request import Request, urlopen

ENV = Path(__file__).resolve().parent.parent / ".env.local"
HOST = "https://open.larksuite.com"
TXN = "tblVkJV8f3RCY8xi"
MASTER = "tblhhsgGkvjFqVzM"
ALEX_REC = "recvcoC3Zv7s2z"
TEST_TXN_ID = sys.argv[1] if len(sys.argv) > 1 else "2605-2875a8"


def env():
    d = {}
    for ln in ENV.read_text(encoding="utf-8").splitlines():
        ln = ln.strip()
        if ln and not ln.startswith("#") and "=" in ln:
            k, v = ln.split("=", 1)
            d[k.strip()] = v.strip()
    return d


def post(u, p, h=None):
    headers = {"Content-Type": "application/json", **(h or {})}
    r = Request(u, data=json.dumps(p).encode(), headers=headers, method="POST")
    try:
        return json.loads(urlopen(r).read())
    except Exception as ex:
        print(f"POST error on {u}: {ex}")
        if hasattr(ex, "read"):
            print(ex.read().decode(errors="replace"))
        raise


def get(u, h):
    return json.loads(urlopen(Request(u, headers=h, method="GET")).read())


e = env()
tok = post(f"{HOST}/open-apis/auth/v3/tenant_access_token/internal", {"app_id": e["LARK_APP_ID"], "app_secret": e["LARK_APP_SECRET"]})["tenant_access_token"]
auth = {"Authorization": f"Bearer {tok}"}

# Search for the test transaction by its Transaction ID
r = post(
    f"{HOST}/open-apis/bitable/v1/apps/{e['LARK_BASE_ID']}/tables/{TXN}/records/search?page_size=10",
    {
        "filter": {
            "conjunction": "and",
            "conditions": [{"field_name": "Transaction ID", "operator": "is", "value": [TEST_TXN_ID]}],
        }
    },
    h=auth,
)
items = r.get("data", {}).get("items", [])
print(f"Found {len(items)} record(s) with Transaction ID = {TEST_TXN_ID}")
if not items:
    print("FAIL: test transaction not in Lark")
    sys.exit(1)

it = items[0]
print(f"  record_id = {it['record_id']}")
for k, v in it["fields"].items():
    print(f"  {k}: {v}")

# Check Master Records for Alex
print(f"\nMaster Records for Alex Cruz (recordId={ALEX_REC}):")
m = get(f"{HOST}/open-apis/bitable/v1/apps/{e['LARK_BASE_ID']}/tables/{MASTER}/records/{ALEX_REC}", auth)
for k, v in m["data"]["record"]["fields"].items():
    print(f"  {k}: {v}")

# Print the record_id so we can use it for cleanup
print(f"\nTEST_RECORD_ID={it['record_id']}")
