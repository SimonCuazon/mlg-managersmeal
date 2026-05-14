"""Cleanup Branch SingleSelect options on Transaction History.

What it does (SAFE):
  1. Renames option 'Manilay Bay' -> 'Manila Bay' (preserves option id, so historical rows
     auto-update).

What it does NOT do (reports only — manual merge is safer):
  2. Detects duplicate option names (e.g. 'EVO' appears 3 times under different ids).
     Merging requires re-pointing existing record references and is too risky to automate
     blind.
"""
import json
from collections import defaultdict
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ENV = Path(__file__).resolve().parent.parent / ".env.local"
HOST = "https://open.larksuite.com"
TXN = "tblVkJV8f3RCY8xi"
BRANCH_FIELD = "fldJ7sykaC"


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
    data = json.dumps(payload).encode() if payload is not None else None
    if data:
        h = {"Content-Type": "application/json", **h}
    req = Request(url, data=data, headers=h, method=method)
    try:
        return json.loads(urlopen(req).read())
    except HTTPError as e:
        body = e.read().decode(errors="replace")
        try:
            return json.loads(body)
        except Exception:
            return {"code": -1, "msg": f"HTTP {e.code}: {body}"}


e = env()
tok = http("POST", f"{HOST}/open-apis/auth/v3/tenant_access_token/internal",
           payload={"app_id": e["LARK_APP_ID"], "app_secret": e["LARK_APP_SECRET"]})["tenant_access_token"]
auth = {"Authorization": f"Bearer {tok}"}

# Fetch current options
fields = http("GET", f"{HOST}/open-apis/bitable/v1/apps/{e['LARK_BASE_ID']}/tables/{TXN}/fields?page_size=100",
              headers=auth)
branch = next(f for f in fields["data"]["items"] if f["field_id"] == BRANCH_FIELD)
options = branch["property"]["options"]
print(f"Current option count: {len(options)}\n")

# Detect duplicates (same display name, different ids)
by_name = defaultdict(list)
for o in options:
    by_name[o["name"]].append(o["id"])
dupes = {n: ids for n, ids in by_name.items() if len(ids) > 1}

if dupes:
    print("=== DUPLICATES (manual merge needed in Lark UI) ===")
    for n, ids in dupes.items():
        print(f"  '{n}'  ids={ids}")
    print()
else:
    print("No duplicates.\n")

# Apply rename: 'Manilay Bay' typo
TYPO = "Mama Lou's Italian Kitchen - Manilay Bay"
FIXED = "Mama Lou's Italian Kitchen - Manila Bay"

target = next((o for o in options if o["name"] == TYPO), None)
if not target:
    print(f"No option named '{TYPO}' — already renamed or never existed.")
else:
    new_options = []
    for o in options:
        if o["id"] == target["id"]:
            new_options.append({"id": o["id"], "name": FIXED, "color": o.get("color", 0)})
        else:
            new_options.append({"id": o["id"], "name": o["name"], "color": o.get("color", 0)})

    resp = http(
        "PUT",
        f"{HOST}/open-apis/bitable/v1/apps/{e['LARK_BASE_ID']}/tables/{TXN}/fields/{BRANCH_FIELD}",
        headers=auth,
        payload={
            "field_name": "Branch",
            "type": 3,  # SingleSelect
            "property": {"options": new_options},
        },
    )
    if resp.get("code") == 0:
        print(f"Renamed '{TYPO}' -> '{FIXED}' (option id preserved: {target['id']})")
        print("Historical rows referencing this option auto-update.")
    else:
        print(f"Rename FAILED: {resp}")
