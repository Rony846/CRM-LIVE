#!/usr/bin/env python3
"""Ingest the MuscleGrid Smart Battery (LFP / JK-PB1A15-16S10P BMS) USER MANUAL (Files-for-Claude #431)
into db.kb_articles — the shared knowledge base that EVERY customer-facing brain grounds on (voice /omnidim/ask,
email Pratibha, WhatsApp Kalpana, the local 32B). This is the "hard-code into memory for all models" step.

Also binds all four product manuals (Titan, Heavy Duty, Focus/MG6500, LFP Battery) into one
'MuscleGrid Troubleshooting Book' via a `book` tag, so the whole library is one queryable unit.

Idempotent: upsert by title. Re-run safely.
"""
import asyncio
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

BOOK = "MuscleGrid Troubleshooting Book"
SRC = "MuscleGrid Smart Battery — LFP User Manual / JK-PB1A15-16S10P BMS (Files-for-Claude #431)"
PREFIX = "MuscleGrid Smart Battery (LFP)"

# Fault-code table (1-9) — matches the JK BMS already in KB; re-stated here so the battery manual is self-contained.
FAULTS = {
    1: "Single-cell over-release / over-discharge alarm — a cell dropped below the undervoltage limit. Reduce load / recharge.",
    2: "Single-cell overcharge alarm — a cell exceeded the overcharge voltage. Stop charging; check charger voltage.",
    3: "Overflow / overcurrent alarm — charge or discharge current exceeded the set limit. Reduce load or charger current.",
    4: "MOS over-temperature alarm — the BMS MOSFETs are too hot (protect at 100°C). Improve ventilation / reduce current.",
    5: "Battery over-temperature alarm — cell temperature too high (protect at 70°C). Stop use, let it cool, check ambient.",
    6: "Short-circuit alarm — a short was detected on the output. Disconnect load, check wiring for a dead short.",
    7: "Internal communication abnormal alarm — BMS internal comms fault. Restart the BMS; if it persists, it needs service.",
    8: "Balance-line resistance too high alarm — a balance/sense wire is loose, corroded or poorly crimped. Re-seat the balance harness.",
    9: "Drop string alarm — a cell/series connection is lost (open cell tap). Check the balance leads and cell links; needs service if a link is broken.",
}

ARTICLES = [
    ("Fault codes (display area 1) — full table",
     "The battery display shows the active fault code as a number under the fault icon; multiple faults scroll. "
     "Codes: " + "; ".join(f"{k} = {v}" for k, v in FAULTS.items())),
]
# Individual fault-code articles (so retrieval by 'fault 8' / 'error 9' hits directly)
for _c, _t in FAULTS.items():
    ARTICLES.append((f"Fault code {_c:02d}: " + _t.split(" — ")[0], _t))

ARTICLES += [
    ("Boot, shutdown & display screen",
     "BOOT: after wiring, press the white button on the right of the display for 1-2 seconds. SHUTDOWN: while on, "
     "long-press the white button ~5 seconds. Display areas: (1) fault code number under the fault icon; "
     "(2) warning icon = abnormal warning; (3) power/SOC % (e.g. 88%); (4) charge/discharge current — a leading '-' "
     "means discharging (negative), no '-' means charging; (5) total pack voltage. Power-save: screen sleeps ~10s after "
     "no current/keys; stays bright while discharging; a key-press wakes it."),

    ("Active balancer — how it works & settings",
     "Uses active (energy-transfer) balancing: energy moves from the higher-voltage cell to the lower one via the board, "
     "keeping cells matched — improving range and battery life. Max continuous balance current 1A (model dependent, up to 2A). "
     "In the BMS app set battery type first, then cell count, capacity and the balance trigger differential (default 0.01V) — "
     "balancing turns on automatically when any two cells differ by more than the set value. Keep balance current ≤ 0.2C of "
     "pack capacity. Balancing can be switched OFF on the app's BMS control page if not needed."),

    ("Heating function (low-temperature)",
     "Standard resistance-heater / heating-film keeps the pack warm in cold weather so charge/discharge don't fail at low "
     "temperature. Design heating current ~4A, switched on the app's BMS control page. Recommended to add a normally-closed "
     "45-65°C temperature switch in series as a secondary cut-off against thermal runaway."),

    ("Overcharge (charge overvoltage) protection",
     "If any cell goes over-voltage during charging, the BMS turns charging OFF to protect the cell, and re-enables it after "
     "the cell falls to the recovery voltage. LiFePO4 defaults: overcharge protect 3.6V per cell, recover 3.54V per cell. "
     "Set on the app's parameter page."),

    ("Over-discharge (discharge undervoltage) protection",
     "If any cell drops below the undervoltage limit while discharging, the BMS turns discharge OFF to prevent over-discharge, "
     "and re-enables it once cells recover. LiFePO4 defaults: undervoltage protect 2.6V, recover 2.65V, automatic shutdown 2.5V "
     "(below this the board powers itself off to save the pack). Recharge to release."),

    ("Charge / discharge over-current protection",
     "If charge current exceeds the set continuous charge current for the charge-overcurrent delay, charging is cut and re-enabled "
     "after the release time. Same for discharge. LiFePO4 defaults: charge OC delay 3s / release 60s; discharge OC delay 300s / "
     "release 60s. Also a charge current-limiting mode holds charge ~10A when over-current."),

    ("Over-temperature & low-temperature protection",
     "Charge/discharge over-temperature protection cuts charging or discharging when the sensor reads above the set value and "
     "restores below the recovery value. LiFePO4 defaults: charge & discharge over-temp protect 70°C, recover 60°C; MOS over-temp "
     "protect 100°C, recover 80°C. Charging low-temp protect -20°C, recover -10°C (use the heating function in very cold areas)."),

    ("Short-circuit protection",
     "Standard short-circuit protection (delay default 1500µs, release 60s). If it false-trips the FIRST time you connect a "
     "charger or a load (in-rush from a charger with high peak current, or a load with large input capacitance), increase the "
     "short-circuit protection delay on the app — after confirming the external wiring has no real short."),

    ("Intelligent sleep",
     "To save power, the board sleeps when it is in standby (charge/discharge current < 1A for 26 continuous hours). Wake it by "
     "pressing the button or by connecting the charger. Can be turned on/off on the app's BMS control page."),

    ("Communication (CAN / RS485) & inverter protocol",
     "Has CAN and two RS485 ports. CAN default rate 250K. RS485-1 talks to the inverter — pick the matching inverter brand/protocol "
     "in the BMS app. RS485-2 is for connecting battery packs in parallel to a host/PC (default baud 115200). Parallel address is set "
     "by the DIP switch, range 0-15."),

    ("LiFePO4 default parameters (setpoints)",
     "Per-cell LiFePO4 defaults programmed in the BMS app: balancing start 3.0V; balance current 1-2A; overcharge protect 3.6V, "
     "recover 3.54V; undervoltage protect 2.6V, recover 2.65V; auto-shutdown 2.5V; SOC-0% = 2.6V; SOC-100% = 3.5V; balance trigger "
     "differential 0.01V; charge OC delay 3s / release 60s; discharge OC delay 300s / release 60s; short-circuit delay 1500µs / "
     "release 60s; charge & discharge over-temp 70°C protect / 60°C recover; charge low-temp -20°C protect / -10°C recover; "
     "MOS over-temp 100°C protect / 80°C recover."),

    ("Specifications",
     "BMS JK-PB1A15-16S10P (JK-Energy Storage Series, active balancer, firmware 15.4.1). Supply voltage 20-70V; standby draw 12mW, "
     "operating 1100mW; operating temperature -30 to 70°C; up to 16S (8S/15S/16S); balance current 1-2A; max continuous charge & "
     "discharge 100A (10P) / 150A (15P) / 200A (20P); max instantaneous 200/300/400A; board size 300×100×18mm; weight ~1000g. "
     "Chemistries supported: LiFePO4, Li-ion (ternary), LTO — set the correct type in the app."),

    ("BMS app (Bluetooth) & warranty note",
     "The battery has a Bluetooth BMS app (Android 7+ / iOS) to view status, change parameters and control the charge/discharge "
     "switch. Scan the QR in the booklet to install. IMPORTANT (MuscleGrid policy): the customer receives the battery-control app "
     "only AFTER registering the product warranty and uploading a product photo at musclegrid.in/warranty."),

    ("Device activation & first power-on",
     "Before power-on, check the balance cable is properly connected and P- / B- are correct, and the board is securely fixed to "
     "the cells — wrong connection can cause abnormal operation or burning. The board has no power switch; it uses CHARGING "
     "ACTIVATION — connect a charger whose voltage is ~2V above the pack, after assembly, to wake the board. It also supports "
     "key activation and display activation (plug in the display cable and press the button)."),

    ("Service contacts (battery)",
     "For battery / BMS service: email lithium@musclegrid.in or service@musclegrid.in; phone 9999036254 or 8279619312."),
]


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    now = datetime.now(timezone.utc).isoformat()
    n_new = n_upd = 0
    for short, content in ARTICLES:
        title = f"{PREFIX} — {short}"
        r = await db.kb_articles.update_one(
            {"title": title},
            {"$set": {"title": title, "content": content, "device_type": "Battery",
                      "source": SRC, "book": BOOK, "product": PREFIX, "status": "published",
                      "tags": ["battery", "lfp", "lifepo4", "jk bms", "troubleshooting"], "updated_at": now},
             "$setOnInsert": {"created_at": now}},
            upsert=True)
        if r.upserted_id:
            n_new += 1
        else:
            n_upd += 1
    print(f"LFP battery articles: {n_new} new, {n_upd} updated")

    # Bind ALL four product manuals into the one Troubleshooting Book (by their source strings).
    book_sources = {
        "MuscleGrid Titan Series Manual (Files-for-Claude #164)": "Titan Series (inverter)",
        "MuscleGrid Heavy Duty Series Manual 3.6–6.2kW (Files-for-Claude #166)": "Heavy Duty Series (inverter)",
        "User Manual MG6500-48 (Files-for-Claude #197)": "Focus 6.2kW / MG6500-48 (inverter)",
        "MuscleGrid Smart Battery — JK BMS Manual (JK-PB1A15-16S10P) (Files-for-Claude)": "MuscleGrid Smart Battery (JK BMS)",
        SRC: PREFIX,
    }
    tagged = 0
    for src, product in book_sources.items():
        r = await db.kb_articles.update_many(
            {"source": src},
            {"$set": {"book": BOOK, "product": product}})
        tagged += r.modified_count
    total_book = await db.kb_articles.count_documents({"book": BOOK})
    print(f"Bound into '{BOOK}': tagged {tagged} more; book now holds {total_book} manual articles across "
          f"{len(book_sources)} products.")

asyncio.run(main())
