#!/usr/bin/env python3
"""Import the old legal-panel website (MySQL dump + uploaded docs) into the CRM so cases can be
tracked here. Reads cases / case_comments / users from the .sql dump, copies the client PDFs into
the CRM upload store, and writes db.legal_cases (comments embedded). Idempotent on the old case id.

NOTE: the old `users` table stores PLAINTEXT passwords — these are deliberately NOT imported as
CRM credentials. We only keep the display name to attribute created_by / comment authors.

Usage: import_legal_cases.py [--commit]
"""
import re, sys, uuid, shutil, os
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
COMMIT = "--commit" in sys.argv
NOW = datetime.now(timezone.utc).isoformat()
SQL = "/var/www/crm/backend/uploads/claude_files/190_u713296379_legal.sql"
DOCS_SRC = "/tmp/ph/legal-panel/uploads"
DOCS_DST = "/var/www/crm/backend/uploads/legal_cases"

text = open(SQL, encoding="utf-8", errors="replace").read()


def split_rows(body):
    rows, i, n, depth, in_str, cur = [], 0, len(body), 0, False, ""
    while i < n:
        c = body[i]
        if in_str:
            cur += c
            if c == "\\" and i + 1 < n:
                cur += body[i + 1]; i += 2; continue
            if c == "'":
                in_str = False
            i += 1; continue
        if c == "'":
            in_str = True; cur += c; i += 1; continue
        if c == "(":
            depth += 1
            if depth == 1:
                cur = ""; i += 1; continue
        if c == ")":
            depth -= 1
            if depth == 0:
                rows.append(cur); i += 1; continue
        cur += c; i += 1
    return rows


def parse_row(s):
    vals, i, n, cur, in_str = [], 0, len(s), "", False
    while i < n:
        c = s[i]
        if in_str:
            if c == "\\" and i + 1 < n:
                cur += {"n": "\n", "t": "\t", "r": "\r", "0": ""}.get(s[i + 1], s[i + 1]); i += 2; continue
            if c == "'":
                in_str = False; i += 1; continue
            cur += c; i += 1; continue
        if c == "'":
            in_str = True; i += 1; continue
        if c == ",":
            vals.append(cur.strip()); cur = ""; i += 1; continue
        cur += c; i += 1
    vals.append(cur.strip())
    return [None if v == "NULL" else v for v in vals]


def extract(table, cols):
    m = re.search(r"INSERT INTO .%s. \([^)]*\) VALUES\s*(.+?);\s*(?:--|\nINSERT|\n/\*|\Z)" % table, text, re.S)
    if not m:
        return []
    return [dict(zip(cols, parse_row(r))) for r in split_rows(m.group(1)) if len(parse_row(r)) == len(cols)]


CASES = extract("cases", ["id", "custom_serial", "party_name", "customer_phone", "firm", "order_id",
                          "issue", "client_document", "created_by", "notice_file", "status", "created_at"])
COMMENTS = extract("case_comments", ["id", "case_id", "user_id", "comment_text", "created_at"])
USERS = extract("users", ["id", "name", "email", "password", "role"])
uname = {str(u["id"]): u["name"] for u in USERS}

comments_by_case = {}
for cm in COMMENTS:
    comments_by_case.setdefault(str(cm["case_id"]), []).append({
        "id": str(uuid.uuid4()), "text": cm["comment_text"],
        "by": uname.get(str(cm["user_id"]), "Lawyer"), "at": cm["created_at"]})

# copy docs
copied = 0
if COMMIT:
    os.makedirs(DOCS_DST, exist_ok=True)

firmmap = {f.get("name"): f.get("id") for f in db.firms.find({}, {"name": 1, "id": 1})}


def map_firm_id(name):
    n = (name or "").lower()
    for fname, fid in firmmap.items():
        if fname and fname.lower() in n or n in (fname or "").lower():
            return fid
    if "spv" in n:
        return next((v for k, v in firmmap.items() if "spv" in k.lower()), None)
    if "electronics bay" in n:
        return next((v for k, v in firmmap.items() if "electronics bay" in k.lower()), None)
    return None


new = upd = 0
for c in CASES:
    doc_rel = None
    if c["client_document"]:
        src = os.path.join(DOCS_SRC, c["client_document"])
        if os.path.exists(src):
            doc_rel = f"legal_cases/{c['client_document']}"
            if COMMIT:
                shutil.copyfile(src, os.path.join(DOCS_DST, c["client_document"])); copied += 1
    rec = {
        "old_case_id": int(c["id"]), "serial": c["custom_serial"],
        "party_name": c["party_name"], "customer_phone": (c["customer_phone"] or "").strip(),
        "firm_name": c["firm"], "firm_id": map_firm_id(c["firm"]),
        "order_id": c["order_id"], "issue": c["issue"] or "",
        "client_document": doc_rel, "notice_file": c["notice_file"],
        "status": c["status"] or "notice_pending",
        "created_by_name": uname.get(str(c["created_by"]), "Pawan"),
        "comments": comments_by_case.get(str(c["id"]), []),
        "source": "legal_panel_import", "old_created_at": c["created_at"], "updated_at": NOW,
    }
    if COMMIT:
        ex = db.legal_cases.find_one({"old_case_id": int(c["id"])}, {"_id": 1})
        if ex:
            db.legal_cases.update_one({"old_case_id": int(c["id"])}, {"$set": rec}); upd += 1
        else:
            rec["id"] = str(uuid.uuid4()); rec["created_at"] = NOW
            db.legal_cases.insert_one(rec); new += 1
    else:
        (upd if db.legal_cases.find_one({"old_case_id": int(c["id"])}, {"_id": 1}) else new)

if COMMIT:
    db.legal_cases.create_index("old_case_id", unique=True)

print(f"{'COMMIT' if COMMIT else 'DRY-RUN'}: {len(CASES)} cases, {len(COMMENTS)} comments, {len(USERS)} users")
print(f"  -> legal_cases: {new} new, {upd} updated | docs copied: {copied}/28")
print(f"  firms: {dict((c['firm'], 1) for c in CASES) and __import__('collections').Counter(c['firm'] for c in CASES)}")
if not COMMIT:
    print("(dry-run — add --commit to write)")
