"""One-off: OCR the Titan/Focus inverter user manuals (scanned-image PDFs) with Claude vision
into searchable text in db.product_manuals — one doc per page {series, page, text}.
Idempotent (skips pages already ingested). Run: ./venv/bin/python migrations/ingest_manuals.py
"""
import base64
import os
import uuid

import anthropic
import fitz
from pymongo import MongoClient

HERE = os.path.dirname(os.path.abspath(__file__))
env = {}
for line in open(os.path.join(HERE, "..", ".env")):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")

db = MongoClient(env["MONGO_URL"])[env["DB_NAME"]]
client = anthropic.Anthropic(api_key=env["ANTHROPIC_API_KEY"])

MANUALS = [
    ("titan", os.path.join(HERE, "..", "uploads/claude_files/164_titan_series_user_manual.pdf")),
    ("focus", os.path.join(HERE, "..", "uploads/claude_files/165_focus_series_user_manual.pdf")),
    ("heavy_duty", os.path.join(HERE, "..", "uploads/claude_files/166_user_manual_for_heavy_duty_series_3_6kw-6_2KW.pdf")),
]
PROMPT = ("This is ONE page of a MuscleGrid inverter user manual. Transcribe ALL text on the page accurately "
          "(headings, specs, steps, tables, warnings). ALSO describe any wiring diagrams / figures / connection "
          "instructions in detail — terminal labels, +/- polarity, battery/solar/AC connections, the sequence. "
          "Output plain text only, no preamble.")


def main():
    db.product_manuals.create_index("series")
    for series, path in MANUALS:
        doc = fitz.open(path)
        print(f"=== {series}: {doc.page_count} pages ===", flush=True)
        for i in range(doc.page_count):
            if db.product_manuals.find_one({"series": series, "page": i + 1}, {"_id": 1}):
                continue
            pix = doc[i].get_pixmap(dpi=140)
            b64 = base64.b64encode(pix.tobytes("png")).decode()
            try:
                msg = client.messages.create(
                    model="claude-haiku-4-5", max_tokens=1500,
                    messages=[{"role": "user", "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}},
                        {"type": "text", "text": PROMPT}]}])
                text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text").strip()
            except Exception as e:
                print(f"  page {i+1}: ERROR {e}", flush=True)
                continue
            db.product_manuals.insert_one({"id": str(uuid.uuid4()), "series": series, "page": i + 1, "text": text})
            print(f"  page {i+1}/{doc.page_count}: {len(text)} chars", flush=True)
    print("DONE. product_manuals:", db.product_manuals.count_documents({}), flush=True)


if __name__ == "__main__":
    main()
