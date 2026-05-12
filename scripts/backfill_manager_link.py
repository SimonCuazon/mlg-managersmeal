"""Backfill the Manager link on existing Transaction History rows by matching
the text Name column against Master Records.Name.

Logs unmatched names. Uses batch_update (max 500 per call).
Idempotent: skips rows that already have a Manager link.
"""
import json
import sys
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ENV = Path(__file__).resolve().parent.parent / ".env.local"
HOST = "https://open.larksuite.com"
TXN_TABLE = "tblVkJV8f3RCY8xi"
MASTER_TABLE = "tblhhsgGkvjFqVzM"
LINK_FIELD = "Manager"
NAME_FIELD = "Name"
BATCH_SIZE = 500


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


def get_token(e):
    r = http("POST", f"{HOST}/open-apis/auth/v3/tenant_access_token/internal",
             payload={"app_id": e["LARK_APP_ID"], "app_secret": e["LARK_APP_SECRET"]})
    if r.get("code") != 0:
        raise RuntimeError(f"Auth failed: {r}")
    return r["tenant_access_token"]


def list_all_records(base, table_id, auth, fields=None):
    out = []
    page_token = None
    while True:
        url = f"{HOST}/open-apis/bitable/v1/apps/{base}/tables/{table_id}/records?page_size=500"
        if page_token:
            url += f"&page_token={page_token}"
        if fields:
            url += "&field_names=" + ",".join(f'"{f}"' for f in fields)
        r = http("GET", url, headers=auth)
        if r.get("code") != 0:
            raise RuntimeError(f"List records failed for {table_id}: {r}")
        out.extend(r["data"].get("items", []))
        if not r["data"].get("has_more"):
            break
        page_token = r["data"].get("page_token")
    return out


def cell_text(v):
    """Lark returns text fields as either a plain string OR a list of {text, type} parts."""
    if v is None:
        return ""
    if isinstance(v, str):
        return v.strip()
    if isinstance(v, list):
        return "".join(part.get("text", "") if isinstance(part, dict) else str(part) for part in v).strip()
    return str(v).strip()


def main():
    e = env()
    tok = get_token(e)
    auth = {"Authorization": f"Bearer {tok}"}
    base = e["LARK_BASE_ID"]

    print("Loading Master Records...")
    masters = list_all_records(base, MASTER_TABLE, auth)
    name_to_id = {}
    for m in masters:
        n = cell_text(m["fields"].get("Name"))
        if n:
            name_to_id[n.lower()] = m["record_id"]
    print(f"  {len(name_to_id)} managers indexed")

    print("Loading Transaction History...")
    txns = list_all_records(base, TXN_TABLE, auth)
    print(f"  {len(txns)} transactions")

    updates = []
    unmatched = {}
    already_linked = 0
    for t in txns:
        f = t["fields"]
        mgr_val = f.get(LINK_FIELD)
        # Link field shape: [{table_id, text_arr: [...names...], type, record_ids?: [...]}]
        # A real link has non-empty text_arr (or record_ids). An empty envelope means unlinked.
        is_linked = False
        if isinstance(mgr_val, list) and mgr_val:
            entry = mgr_val[0] if isinstance(mgr_val[0], dict) else {}
            if entry.get("record_ids") or entry.get("text_arr"):
                is_linked = True
        if is_linked:
            already_linked += 1
            continue
        name = cell_text(f.get(NAME_FIELD))
        rec_id = name_to_id.get(name.lower())
        if not rec_id:
            unmatched[name] = unmatched.get(name, 0) + 1
            continue
        updates.append({
            "record_id": t["record_id"],
            "fields": {LINK_FIELD: [rec_id]},
        })

    print(f"\nAlready linked: {already_linked}")
    print(f"To update:     {len(updates)}")
    print(f"Unmatched:     {sum(unmatched.values())} ({len(unmatched)} unique names)")
    if unmatched:
        print("  Unmatched names (count):")
        for n, c in sorted(unmatched.items(), key=lambda x: -x[1])[:20]:
            print(f"    {c:>4} x  '{n}'")

    if not updates:
        print("\nNothing to update. Done.")
        return 0

    print(f"\nApplying updates in batches of {BATCH_SIZE}...")
    for i in range(0, len(updates), BATCH_SIZE):
        chunk = updates[i:i + BATCH_SIZE]
        r = http(
            "POST",
            f"{HOST}/open-apis/bitable/v1/apps/{base}/tables/{TXN_TABLE}/records/batch_update",
            headers=auth,
            payload={"records": chunk},
        )
        if r.get("code") != 0:
            print(f"  Batch {i // BATCH_SIZE + 1} FAILED: {r}")
            return 1
        print(f"  Batch {i // BATCH_SIZE + 1}: {len(chunk)} records updated")

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
