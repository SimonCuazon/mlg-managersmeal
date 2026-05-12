"""Read sample records from Master Records and Transaction History."""
import json
import sys
from pathlib import Path
from urllib.request import Request, urlopen

ENV_PATH = Path(__file__).resolve().parent.parent / ".env.local"
LARK_HOST = "https://open.larksuite.com"

MASTER_TABLE = "tblhhsgGkvjFqVzM"
TXN_HISTORY_TABLE = "tblVkJV8f3RCY8xi"


def load_env(path):
    env = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env


def post_json(url, payload, headers=None):
    h = {"Content-Type": "application/json", **(headers or {})}
    req = Request(url, data=json.dumps(payload).encode("utf-8"), headers=h, method="POST")
    with urlopen(req) as r:
        return json.loads(r.read().decode("utf-8"))


def get_json(url, headers):
    req = Request(url, headers=headers, method="GET")
    with urlopen(req) as r:
        return json.loads(r.read().decode("utf-8"))


def main():
    env = load_env(ENV_PATH)
    tok = post_json(
        f"{LARK_HOST}/open-apis/auth/v3/tenant_access_token/internal",
        {"app_id": env["LARK_APP_ID"], "app_secret": env["LARK_APP_SECRET"]},
    )["tenant_access_token"]
    auth = {"Authorization": f"Bearer {tok}"}
    base = env["LARK_BASE_ID"]

    print("=== MASTER RECORDS — first 5 rows ===")
    r = get_json(
        f"{LARK_HOST}/open-apis/bitable/v1/apps/{base}/tables/{MASTER_TABLE}/records?page_size=5",
        auth,
    )
    for item in r["data"]["items"]:
        print(f"\nrecord_id={item['record_id']}")
        for k, v in item["fields"].items():
            print(f"  {k}: {v}")

    print(f"\n\nTotal master records: {r['data'].get('total', '?')}")

    print("\n\n=== TRANSACTION HISTORY — first 5 rows ===")
    r = get_json(
        f"{LARK_HOST}/open-apis/bitable/v1/apps/{base}/tables/{TXN_HISTORY_TABLE}/records?page_size=5",
        auth,
    )
    for item in r["data"]["items"]:
        print(f"\nrecord_id={item['record_id']}")
        for k, v in item["fields"].items():
            print(f"  {k}: {v}")

    print(f"\n\nTotal transaction history records: {r['data'].get('total', '?')}")


if __name__ == "__main__":
    sys.exit(main() or 0)
