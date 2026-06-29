"""Ticket-history RAG — Kalpana's "I've seen this 100 times" memory.

Indexes every resolved CRM ticket (db.tickets — issue + diagnosis/repair_notes/agent_notes)
and every Zoho ticket (db.zoho_tickets — subject/category as issue-pattern signal) into a
single searchable store (db.kb_ticket_history) with a Mongo TEXT index. Retrieval is a free,
local full-text query — NO API/embeddings cost — so the support agent can ground a hard turn
in how MuscleGrid actually resolved the same problem before.

Build/refresh: `await reindex(db)`. Query: `await search(db, query, limit, product)`.
Everything is derived data — reindex wipes + rebuilds; safe to re-run any time.
"""
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

COLL = "kb_ticket_history"
_RESOLVED_STATUSES = {"closed", "resolved", "repair_completed", "delivered",
                      "resolved_on_call", "collected", "reship_completed"}


def _clip(s, n=600):
    return (str(s or "").strip())[:n]


def _ticket_entry(t: dict) -> dict | None:
    problem = _clip(t.get("issue_description"))
    resolution = _clip(" • ".join(x for x in (t.get("diagnosis"), t.get("repair_notes"),
                                               t.get("agent_notes")) if x), 900)
    if not (problem or resolution):
        return None
    product = _clip(t.get("product_name") or t.get("device_type"), 80)
    return {
        "source": "crm", "ref": t.get("ticket_number") or t.get("id"),
        "product": product, "problem": problem, "resolution": resolution,
        "status": t.get("status"), "has_resolution": bool(resolution),
        "blob": " ".join(filter(None, [product, problem, resolution])),
    }


def _zoho_entry(z: dict) -> dict | None:
    problem = _clip(z.get("subject"))
    if not problem:
        return None
    product = _clip(z.get("category"), 80)
    return {
        "source": "zoho", "ref": z.get("ticket_number") or z.get("id"),
        "product": product, "problem": problem, "resolution": "",
        "status": z.get("status"), "has_resolution": False,
        "blob": " ".join(filter(None, [product, problem])),
    }


async def reindex(db) -> dict:
    """Wipe + rebuild the ticket-history store from db.tickets + db.zoho_tickets. Returns counts."""
    now = datetime.now(timezone.utc).isoformat()
    docs, crm_n, zoho_n = [], 0, 0
    # CRM tickets — the real resolution corpus (prefer resolved, but index any with an issue).
    async for t in db.tickets.find({}, {"_id": 0, "ticket_number": 1, "id": 1, "issue_description": 1,
                                        "diagnosis": 1, "repair_notes": 1, "agent_notes": 1,
                                        "product_name": 1, "device_type": 1, "status": 1}):
        e = _ticket_entry(t)
        if e:
            e["indexed_at"] = now
            docs.append(e); crm_n += 1
    # Zoho tickets — issue-pattern signal (subjects/categories).
    async for z in db.zoho_tickets.find({}, {"_id": 0, "ticket_number": 1, "id": 1, "subject": 1,
                                             "category": 1, "status": 1}):
        e = _zoho_entry(z)
        if e:
            e["indexed_at"] = now
            docs.append(e); zoho_n += 1
    await db[COLL].delete_many({})
    if docs:
        # insert in chunks to stay well under the 16MB BSON batch limit
        for i in range(0, len(docs), 1000):
            await db[COLL].insert_many(docs[i:i + 1000], ordered=False)
    # (Re)create the text index for free full-text retrieval.
    try:
        await db[COLL].create_index([("blob", "text")], name="blob_text", default_language="none")
    except Exception as e:
        logger.warning(f"ticket_history text index: {e}")
    logger.info(f"ticket_history reindex: crm={crm_n} zoho={zoho_n} total={len(docs)}")
    return {"crm": crm_n, "zoho": zoho_n, "total": len(docs)}


async def search(db, query: str, limit: int = 5, product: str = None) -> list:
    """Free local full-text search over past tickets. Returns the closest prior cases, resolution-
    bearing ones first. `product` softly biases toward matching product/series text."""
    q = (query or "").strip()
    if not q:
        return []
    search_str = f"{q} {product}" if product else q
    try:
        cur = db[COLL].find({"$text": {"$search": search_str}},
                            {"_id": 0, "score": {"$meta": "textScore"}}) \
            .sort([("score", {"$meta": "textScore"})]).limit(limit * 4)
        rows = await cur.to_list(limit * 4)
    except Exception as e:
        logger.warning(f"ticket_history search failed ({e}); falling back to regex")
        rows = await db[COLL].find(
            {"blob": {"$regex": q.split()[0] if q.split() else q, "$options": "i"}},
            {"_id": 0}).limit(limit * 4).to_list(limit * 4)
        for r in rows:
            r["score"] = 1.0
    # Re-rank: a case WITH a recorded resolution is worth more than a bare subject match.
    rows.sort(key=lambda r: (r.get("score", 0) + (1.5 if r.get("has_resolution") else 0)), reverse=True)
    out = []
    for r in rows[:limit]:
        out.append({"ref": r.get("ref"), "source": r.get("source"), "product": r.get("product"),
                    "problem": r.get("problem"), "resolution": r.get("resolution") or None,
                    "status": r.get("status")})
    return out
