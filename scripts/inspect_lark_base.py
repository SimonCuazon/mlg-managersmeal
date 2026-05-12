"""Inspect the Lark Base: list tables and their fields. Never prints the secret."""
import json
import os
import sys
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ENV_PATH = Path(__file__).resolve().parent.parent / ".env.local"
LARK_HOST = "https://open.larksuite.com"


def load_env(path: Path) -> dict[str, str]:
    env = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env


def post_json(url: str, payload: dict, headers: dict | None = None) -> dict:
    data = json.dumps(payload).encode("utf-8")
    h = {"Content-Type": "application/json", **(headers or {})}
    req = Request(url, data=data, headers=h, method="POST")
    with urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_json(url: str, headers: dict) -> dict:
    req = Request(url, headers=headers, method="GET")
    try:
        with urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        return {"code": -1, "msg": f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')}"}


def main() -> int:
    env = load_env(ENV_PATH)
    app_id = env.get("LARK_APP_ID")
    app_secret = env.get("LARK_APP_SECRET")
    base_id = env.get("LARK_BASE_ID")
    if not app_id or not app_secret or app_secret == "PASTE_NEW_SECRET_HERE":
        print("ERROR: LARK_APP_ID/LARK_APP_SECRET not set in .env.local")
        return 1
    if not base_id:
        print("ERROR: LARK_BASE_ID not set in .env.local")
        return 1

    token_resp = post_json(
        f"{LARK_HOST}/open-apis/auth/v3/tenant_access_token/internal",
        {"app_id": app_id, "app_secret": app_secret},
    )
    if token_resp.get("code") != 0:
        print(f"Auth failed: {token_resp}")
        return 1
    token = token_resp["tenant_access_token"]
    print(f"OK: got tenant_access_token (expires in {token_resp.get('expire')}s)")

    auth = {"Authorization": f"Bearer {token}"}
    tables_resp = get_json(
        f"{LARK_HOST}/open-apis/bitable/v1/apps/{base_id}/tables?page_size=100",
        auth,
    )
    if tables_resp.get("code") != 0:
        print(f"List tables failed: {tables_resp}")
        return 1

    tables = tables_resp["data"]["items"]
    print(f"\nFound {len(tables)} table(s) in base {base_id}:\n")
    for t in tables:
        print(f"  - {t['name']}  (id={t['table_id']})")

    print()
    for t in tables:
        print(f"\n=== Table: {t['name']} (id={t['table_id']}) ===")
        fields_resp = get_json(
            f"{LARK_HOST}/open-apis/bitable/v1/apps/{base_id}/tables/{t['table_id']}/fields?page_size=100",
            auth,
        )
        if fields_resp.get("code") != 0:
            print(f"  ERROR listing fields: {fields_resp}")
            continue
        for f in fields_resp["data"]["items"]:
            ftype = f.get("ui_type") or f.get("type")
            print(f"  - {f['field_name']:<30} type={ftype:<15} id={f['field_id']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
