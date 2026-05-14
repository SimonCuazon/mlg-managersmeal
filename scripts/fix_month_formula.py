"""Fix the broken Month formula on Transaction History.

Old: SWITCH on Month Number (which is "MONTH+YEAR" — never matches 1-12).
New: SWITCH on MONTH(Date) directly — returns "May", "June", etc.
"""
import json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ENV = Path(__file__).resolve().parent.parent / ".env.local"
HOST = "https://open.larksuite.com"
TXN = "tblVkJV8f3RCY8xi"
MONTH_FIELD = "flddbdPSVO"

NEW_FORMULA = (
    'SWITCH(MONTH(bitable::$table[tblVkJV8f3RCY8xi].$field[fldZxGm9RU]),'
    ' 1, "January",'
    ' 2, "February",'
    ' 3, "March",'
    ' 4, "April",'
    ' 5, "May",'
    ' 6, "June",'
    ' 7, "July",'
    ' 8, "August",'
    ' 9, "September",'
    ' 10, "October",'
    ' 11, "November",'
    ' 12, "December",'
    ' "Invalid Month"'
    ')'
)


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

resp = http(
    "PUT",
    f"{HOST}/open-apis/bitable/v1/apps/{e['LARK_BASE_ID']}/tables/{TXN}/fields/{MONTH_FIELD}",
    headers=auth,
    payload={
        "field_name": "Month",
        "type": 20,  # Formula
        "property": {"formula_expression": NEW_FORMULA},
    },
)
print(json.dumps(resp, indent=2))
