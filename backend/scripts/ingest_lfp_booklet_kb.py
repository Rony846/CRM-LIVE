#!/usr/bin/env python3
"""Ingest the customer-facing MuscleGrid LFP Battery BOOKLET (Files-for-Claude #432, vision-read) into
db.kb_articles — the series range, inverter closed-loop settings, installation, parallel rules, warranty,
safety and care. Complements the technical BMS manual (#431). Idempotent (upsert by title)."""
import asyncio
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

BOOK = "MuscleGrid Troubleshooting Book"
SRC = "MuscleGrid LFP Battery Booklet — Spec & User Guide (Files-for-Claude #432)"
PREFIX = "MuscleGrid Smart Battery (LFP)"

ARTICLES = [
    ("Series range — Prime / Thunder Pro / Signature",
     "MuscleGrid LFP batteries come in 3 series sharing the same A+ grade LiFePO4 prismatic cells and steel case; "
     "the series sets the BMS/display. PRIME (essential): basic BMS, mobile app, passive cell balancing. THUNDER PRO: "
     "JK Smart BMS, LCD display + mobile app, 1A active balancer (best for solar/closed-loop inverter control). "
     "SIGNATURE (flagship): touch-screen display on every model, JK Smart BMS, 1A active balancer — plus 51.2V 314Ah "
     "and 640Ah towers (8000+ cycle cells, 200A JK BMS, 2A active balancer, up to 32.7 kWh per tower). "
     "Models: 25.6V / 48V / 51.2V in 100Ah & 120Ah. Which to pick: Prime = dependable everyday backup at best price; "
     "Thunder Pro = solar systems wanting closed-loop control + active balancing; Signature = flagship touch-screen "
     "monitoring + large storage."),

    ("Thunder Pro specifications (48V & 51.2V, 120Ah)",
     "Thunder Pro 48V: 15S, 48.0V nominal, 120Ah, 5.76 kWh, max charge 54.7V, discharge cut-off 40.5V, std/max charge "
     "50A/100A, max continuous discharge 100A (200A instantaneous), 6000+ cycles @80% DoD, charge temp 0-55°C, "
     "discharge -20-55°C, M8 terminals torqued 10-12 N·m, indoor floor/rack, upright. Thunder Pro 51.2V: 16S, 51.2V, "
     "120Ah, 6.14 kWh, max charge 58.4V, cut-off 43.2V. Warranty 5 years, 1-time replacement. "
     "Amazon ASIN: 48V = B0D2GMQ8FR, 51.2V = B0DVJ14Z9B (Signature 51.2V 314Ah = B0H72K78Z2)."),

    ("Inverter settings for the battery (closed-loop)",
     "Set the inverter for a MuscleGrid LFP pack. 48V model: battery type Lithium/LFP (or 'USE' custom); bulk/absorption "
     "54.0V; float 53.6V; low-voltage cut-off 42.0V; max charge current 50A recommended (100A max); BMS protocol CAN 250K "
     "or RS485 (select brand in app). 51.2V model: bulk/absorption 57.6V; float 57.0V; cut-off 44.8V. With CAN/RS485 "
     "closed-loop active, the inverter follows the BMS's requested voltage/current automatically — these values are the "
     "safety fallback."),

    ("Installation — site preparation & cabling",
     "Inspect on arrival (case, terminals, display for transit damage — do NOT install a damaged pack, call support; keep "
     "the wooden crate until commissioning is done). Position: dry, ventilated, level indoor spot away from heat, sunlight "
     "and water; upright on floor or rack; ≥100mm clearance on all sides; display facing you; heavy — lift with two people. "
     "Fit a 125A DC MCB or fuse on the POSITIVE line between battery and inverter (this is the service disconnect — leave "
     "OFF until commissioning). Cables: 25-35 mm² copper with crimped M8 lugs, as short as possible (≤2m), both runs equal "
     "length, route + and - together, avoid sharp bends. Professional electrician recommended."),

    ("Connect & commission (order of steps)",
     "With inverter and MCB OFF: connect positive (+, red) to the battery FIRST, then negative (-, black); torque M8 bolts "
     "10-12 N·m; never bridge the two terminals with a tool. For closed-loop, connect the inverter's BMS port to CAN or "
     "RS485-1 on the battery (RS485-2 is only for pack-to-pack parallel linking); select the inverter protocol in the app. "
     "Power-on order: boot the BMS (white button 1-2s) → switch the MCB on → start the inverter; verify voltage/current/SOC "
     "on the LCD or app BEFORE applying load. Then set the inverter parameters and charge the pack to 100% before its first "
     "discharge so the SOC meter calibrates."),

    ("Parallel connection rules (up to 16 packs)",
     "MuscleGrid LFP packs connect in PARALLEL only, up to 16 packs. Rules: parallel IDENTICAL packs only — same model, "
     "capacity and firmware (never mix 48V with 51.2V). Charge every pack to 100% individually before connecting them. Run "
     "equal-length cables from each pack to a common busbar — never daisy-chain the power path. Link packs with the RS485-2 "
     "ports and set a unique DIP-switch address on each (0-15); address 0 is the master — connect it to the inverter. The "
     "BMS parallel current-limiting protects a newly added pack, but matched SOC keeps performance best."),

    ("NEVER connect packs in series (critical)",
     "NEVER connect MuscleGrid LFP packs in SERIES — these models are PARALLEL-ONLY. Series connection VOIDS the warranty "
     "and can damage the BMS."),

    ("Warranty terms (5-year)",
     "5-year warranty with 1-time hassle-free replacement — a local technician visits, diagnoses and swaps on the spot. "
     "Covers manufacturing defects and BMS failures. EXCLUDES physical damage, water ingress, unauthorised servicing, and "
     "series connection. Register within 30 days at newcrm.musclegrid.in and keep the invoice with the booklet — both are "
     "needed for a claim."),

    ("Safety warnings",
     "Never short-circuit or reverse polarity — keep metal tools, jewellery and loose wiring away from the terminals. Never "
     "connect in series (parallel, identical models only). Do not open the case (no user-serviceable parts; opening voids "
     "warranty). Keep away from fire and water; never incinerate. Charge only between 0-55°C (the BMS blocks charging below "
     "-20°C to protect the cells). Disconnect before servicing: switch off the inverter, then the MCB, then shut the BMS "
     "down. Keep away from children. Recycle end-of-life packs via MuscleGrid or an authorised e-waste recycler."),

    ("Care & long-term storage",
     "For long storage keep the pack at ~50% SOC in a cool, dry place and top up every 3 months. Wipe with a dry cloth only "
     "— no solvents, no water jets."),

    ("Fault codes — what the customer should do",
     "When the fault icon lights, the number in display Area 1 is the active fault. Actions: 1 Cell over-discharge → remove "
     "load and recharge immediately. 2 Cell overcharge → check the inverter charge voltage against the settings. 3 Overcurrent "
     "→ reduce the connected load, auto-recovers after release time. 4 MOS over-temperature → improve ventilation, let the pack "
     "cool. 5 Battery over-temperature → stop charge/discharge until temperature normalises. 6 Short-circuit → disconnect the "
     "load, inspect wiring before restart. 7 Internal communication abnormal → restart the BMS; if it persists, call support. "
     "8 Balance-line resistance too high → service required, contact support. 9 Drop string (cell disconnection) → shut down "
     "and contact support, do NOT continue use. If a fault won't clear: note the code, switch the MCB off and call "
     "+91 99990 36254 (24x7, video-call assistance) or service@musclegrid.in."),
]


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    now = datetime.now(timezone.utc).isoformat()
    n_new = n_upd = 0
    for short, content in ARTICLES:
        title = f"{PREFIX} — {short}"
        r = await db.kb_articles.update_one(
            {"title": title},
            {"$set": {"title": title, "content": content, "device_type": "Battery", "source": SRC,
                      "book": BOOK, "product": PREFIX, "status": "published",
                      "tags": ["battery", "lfp", "lifepo4", "thunder pro", "installation", "warranty", "troubleshooting"],
                      "updated_at": now},
             "$setOnInsert": {"created_at": now}},
            upsert=True)
        if r.upserted_id:
            n_new += 1
        else:
            n_upd += 1
    total = await db.kb_articles.count_documents({"book": BOOK})
    print(f"LFP booklet articles: {n_new} new, {n_upd} updated; Troubleshooting Book now {total} articles.")

asyncio.run(main())
