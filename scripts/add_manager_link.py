"""Add a Manager Link field to Transaction History (pointing to Master Records).

Idempotent: if the field already exists, prints the existing id and exits 0.
Does NOT touch any existing field.
"""
import json
import sys
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ENV = Path(__file__).resolve().parent.parent / ".env.local"
HOST = "https://open.larksuite.com"
TXN_TABLE = "tblVkJV8f3RCY8xi"      # Transaction History
MASTER_TABLE = "tblhhsgGkvjFqVzM"   # Master Records
NEW_FIELD_NAME = "Manager"


def env():
    d = {}
    for ln in ENV.read_text(encoding="utf-8").splitlines():
        ln = ln.strip()
        if ln and not ln.startswith("#") and "=" in ln:
            k, v = ln.split("=", 1)
            d[k.strip()] = v.strip()
    return d


def http(method, url, headers=None, payload=None):
    h = headers or {}
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    if data:
        h = {"Content-Type": "application/json", **h}
    req = Request(url, data=data, headers=h, method=method)
    try:
        with urlopen(req) as r:
            return json.loads(r.read().decode("utf-8"))
    except HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        try:
            return json.loads(body)
        except Exception:
            return {"code": -1, "msg": f"HTTP {e.code}: {body}"}


def main():
    e = env()
    tok = http("POST", f"{HOST}/open-apis/auth/v3/tenant_access_token/internal",
               payload={"app_id": e["LARK_APP_ID"], "app_secret": e["LARK_APP_SECRET"]})
    if tok.get("code") != 0:
        print(f"Auth failed: {tok}")
        return 1
    auth = {"Authorization": f"Bearer {tok['tenant_access_token']}"}
    base = e["LARK_BASE_ID"]

    # Check if "Manager" field already exists
    fields = http("GET", f"{HOST}/open-apis/bitable/v1/apps/{base}/tables/{TXN_TABLE}/fields?page_size=100",
                  headers=auth)
    if fields.get("code") != 0:
        print(f"List fields failed: {fields}")
        return 1

    for f in fields["data"]["items"]:
        if f["field_name"] == NEW_FIELD_NAME:
            print(f"OK: '{NEW_FIELD_NAME}' field already exists (id={f['field_id']}, ui_type={f.get('ui_type')})")
            return 0

    # Create the Link field. Lark type 18 = SingleLink (one record per row).
    payload = {
        "field_name": NEW_FIELD_NAME,
        "type": 18,
        "property": {
            "table_id": MASTER_TABLE,
            "multiple": False,
        },
    }
    print(f"Creating field '{NEW_FIELD_NAME}' with payload:\n  {json.dumps(payload)}")
    resp = http(
        "POST",
        f"{HOST}/open-apis/bitable/v1/apps/{base}/tables/{TXN_TABLE}/fields",
        headers=auth,
        payload=payload,
    )
    if resp.get("code") != 0:
        print(f"FAILED to create field: {resp}")
        return 1
    fid = resp["data"]["field"]["field_id"]
    print(f"SUCCESS: created '{NEW_FIELD_NAME}' field (id={fid}) on Transaction History")
    print(f"   Links to: Master Records ({MASTER_TABLE})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
