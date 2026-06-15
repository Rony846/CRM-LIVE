"""Build db.product_series_map: model-code -> manual series, derived from the master_skus catalog.

For each catalog SKU whose NAME resolves to a series (titan/focus/heavy_duty/lithium/stabilizer via
keywords), index its sku_code + aliases as lookup keys. This lets the support agent resolve a bare
model code on a ticket (e.g. "MG-H4862E120-D") to a series even when the code carries no keyword.
Name-based detection is handled live in server.py; this map only adds code/alias coverage.

Run: ./venv/bin/python migrations/build_series_map.py
"""
import os

from pymongo import MongoClient

HERE = os.path.dirname(os.path.abspath(__file__))
env = {}
for line in open(os.path.join(HERE, "..", ".env")):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")

db = MongoClient(env["MONGO_URL"])[env["DB_NAME"]]

RULES = [
    ("titan", ("titan",)),
    ("focus", ("focus",)),
    ("heavy_duty", ("heavy duty", "heavy-duty", "heay duty")),
    ("lithium", ("lithium", "lifepo4", "lifepo", "lfp", "thunder pro")),
    ("stabilizer", ("stabiliz", "servo", "voltage stabil", "kva")),
]


def series_of(name, category=""):
    s = f"{name or ''} {category or ''}".lower()
    for series, kws in RULES:
        if any(k in s for k in kws):
            return series
    return None


def main():
    db.product_series_map.delete_many({})
    rows, by_series = [], {}
    for d in db.master_skus.find({}, {"name": 1, "category": 1, "sku_code": 1, "aliases": 1}):
        series = series_of(d.get("name"), d.get("category"))
        if not series:
            continue
        by_series[series] = by_series.get(series, 0) + 1
        keys = set()
        for k in [d.get("sku_code")] + list(d.get("aliases") or []):
            k = (str(k or "")).strip()
            if len(k) >= 5:  # only distinctive codes, not "5KVA"
                keys.add(k)
        for k in keys:
            rows.append({"key": k, "series": series, "name": d.get("name"), "sku_code": d.get("sku_code")})
    if rows:
        db.product_series_map.insert_many(rows)
    db.product_series_map.create_index("key")
    print("product_series_map keys:", db.product_series_map.count_documents({}))
    print("by series:", by_series)


if __name__ == "__main__":
    main()
