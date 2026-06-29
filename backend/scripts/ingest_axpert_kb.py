"""Ingest the TITAN and HEAVY-DUTY inverter manuals into the shared agent KB.

Source: #164 titan_series_user_manual.pdf, #166 heavy_duty (3.6–6.2kW) — same OEM
(Axpert/Voltronic) platform, so they share ONE code set that is DIFFERENT from Focus
(MG6500-48). Critical: the same number means different things per series, e.g.
  code 52  ->  Focus: "Battery low voltage" (alarm)  |  Titan/HD: "Bus voltage too low" (fault)
That is exactly why every article is tagged with `series` and retrieval prefers it.

Scope: fault codes, warning/alarm codes, BMS code-reference, troubleshooting — all
cleanly transcribed. The LCD setting-program tables in these manuals OCR badly
(garbled segment codes) so they are deliberately NOT ingested — better no answer than
a wrong setpoint. Companion to ingest_mg6500_kb.py.

Run:  cd backend && python scripts/ingest_axpert_kb.py
"""
import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
NOW = datetime.now(timezone.utc).isoformat()

SERIES = {
    "titan": {"model_name": "Titan Series", "source": "MuscleGrid Titan Series Manual (Files-for-Claude #164)",
              "aliases": ["Titan", "Titan Series", "MuscleGrid Titan"]},
    "heavy_duty": {"model_name": "Heavy Duty Series (3.6–6.2kW)",
                   "source": "MuscleGrid Heavy Duty Series Manual 3.6–6.2kW (Files-for-Claude #166)",
                   "aliases": ["Heavy Duty", "Heavy-Duty", "Heavy Duty Series", "HD series", "3.6kW", "4.6kW", "6.2kW"]},
}

# (code, meaning, what_to_do) — FAULT: steady red LED, inverter STOPS, LCD shows the fault code.
FAULTS = [
    ("01", "Fan is locked (when inverter is off), or fan fault", "Replace the fan; ensure it spins freely and is connected."),
    ("02", "Over temperature, or NTC not connected well", "Internal component temp over 100–120 °C — check the unit's airflow isn't blocked and ambient isn't too hot; let it cool."),
    ("03", "Battery voltage is too high (battery over-charged)", "Check battery type/quantity match the unit's spec; if it persists, return to the repair center."),
    ("04", "Battery voltage is too low", "Re-charge the battery; if it won't hold charge, replace it."),
    ("05", "Output short-circuited, or over-temperature detected by internal converter components", "Check output wiring and remove any shorted/abnormal load; ensure airflow isn't blocked."),
    ("06", "Output voltage is too high", "Output abnormal (<190 V or >260 VAC): reduce the connected load; if it persists, return to repair."),
    ("07", "Overload time-out", "Inverter overloaded (>105–110%) and time elapsed: switch off some equipment to reduce load. If caused by high PV derating, reduce PV modules in series."),
    ("08", "Bus voltage is too high", "Internal components fault — return to the repair center."),
    ("09", "Bus soft-start failed", "Internal components fault — return to the repair center."),
    ("51", "Over current or surge", "Restart the unit; if the error recurs, return to the repair center."),
    ("52", "Bus voltage is too low", "Internal fault — return to the repair center."),
    ("53", "Inverter soft-start failed", "Internal components fault — return to the repair center."),
    ("55", "Over DC voltage in AC output (output voltage unbalanced)", "Return to the repair center."),
    ("57", "Current sensor failed", "Internal components fault — return to the repair center."),
    ("58", "Output voltage is too low", "Output abnormal (<190 V or >260 VAC): reduce the connected load; if it persists, return to repair."),
    ("59", "PV voltage is over the limitation", "Reduce the number of PV modules in series so PV input is within spec."),
]

# (code, meaning, audible, what_to_do) — WARNING/ALARM: red LED FLASHES, inverter KEEPS RUNNING.
WARNINGS = [
    ("01", "Fan is locked when inverter is on", "Beeps 3× every second", "Check the cooling fan is connected and spinning."),
    ("02", "Over temperature", "None", "Reduce load; ensure airflow isn't blocked and ambient isn't too hot."),
    ("03", "Battery is over-charged", "Beeps once every second", "Check the charging settings / battery spec."),
    ("04", "Low battery", "Beeps once every second", "Re-charge the battery, or restore mains/PV to charge it."),
    ("07", "Overload", "Beeps once every 0.5 second", "Reduce the connected load by switching off some equipment."),
    ("10", "Output power derating", "Beeps 2× every 3 seconds", "Informational — output is being derated (e.g. high PV/temperature)."),
    ("15", "PV energy is low", "Beeps 2× every 3 seconds", "Informational — insufficient solar; normal at low light."),
    ("16", "High AC input (>280 VAC) during BUS soft start", "None", "Check the incoming mains/generator voltage is within range."),
    ("E9", "Battery equalization in progress", "None", "Informational — equalization charging is running (lead-acid only)."),
    ("bP", "Battery is not connected", "None", "Check the battery wiring/connection."),
]

# (code, meaning, what_to_do) — informational LCD codes shown after a successful BMS (lithium) handshake.
CODE_REF = [
    ("60", "After a successful BMS handshake, the battery is not allowed to charge OR discharge — the inverter stops both", "The lithium battery's BMS is protecting itself; check the battery state / BMS and let it recover."),
    ("61", "Communication lost with the battery BMS (no signal for 1 min when not connected, or comms dropped after a successful connect — buzzer beeps)", "Check the BMS communication cable (RS485/CAN) between battery and inverter."),
    ("62", "After a successful BMS handshake, the battery is not allowed to charge — charging stops", "BMS is blocking charge (e.g. full / protection); informational, recovers on its own."),
    ("70", "After a successful BMS handshake, the battery requests charging — the inverter charges", "Informational — normal BMS-requested charge."),
    ("71", "After a successful BMS handshake, the battery is not allowed to discharge — discharge stops", "BMS is blocking discharge (e.g. low SOC / protection); recovers when the BMS permits."),
]

TROUBLESHOOTING = [
    ("Unit shuts down during startup (LCD/LEDs/buzzer on for 3 s then fully off)", "Battery voltage is low (<1.91 V/cell). Re-charge the battery; replace if it won't hold."),
    ("No response at all after power-on", "Battery far too low (<1.4 V/cell) or the internal fuse tripped. Contact the repair center to replace the fuse; re-charge or replace the battery."),
    ("Mains present but unit runs on battery (green LED flashing)", "Poor AC quality, OR AC wires too thin/long, OR wrong input-voltage-range setting, OR output priority is set to 'Solar First'. Check wiring/setting; set output priority to 'Utility First' if you want grid first."),
    ("Internal relay clicks on/off repeatedly (LCD/LEDs flashing)", "Battery is disconnected — check the battery wires are connected well."),
]

PARALLEL = [  # Titan parallel-kit only (multi-inverter installs)
    ("60", "Power feedback protection"), ("71", "Firmware version inconsistent"),
    ("72", "Current sharing fault"), ("73", "Inconsistent output-voltage settings across parallel units"),
    ("80", "CAN communication fault"), ("81", "Host (master) loss"), ("82", "Synchronization loss"),
    ("83", "Battery voltage detected different between units"),
    ("84", "AC input voltage/frequency detected different between units"),
    ("85", "AC output current unbalance"), ("86", "AC output mode setting is different between units"),
]


# LCD setting programs, transcribed from the PDFs (the OCR was garbled). Grouped into
# retrieval-sized chunks (each ~<600 chars so the agent sees the whole group untruncated).
# Titan and Heavy-Duty have DIFFERENT program tables — kept separate.
_SET_HOWTO = "Enter setup: press & hold ENTER 3 s; UP/DOWN to select a program; ENTER to confirm; ESC to exit. "
SETTINGS = {
    "titan": [
        ("output", "Output & input", _SET_HOWTO +
         "00 Exit setting mode (ESC). 01 Output source priority: 'SUb' = Solar first (utility supplements when solar "
         "is insufficient); 'SbU' = SBU (solar first, then battery; utility only when battery drops to the low-voltage "
         "warning or the program-12 point). 02 Max total charging current (utility+solar): default 60 A, 10 A–max, 10 A "
         "steps. 03 AC input voltage range: 'APL' Appliances (90–280 VAC, default) / 'UPS' (170–280 VAC). 09 Output "
         "frequency 50 Hz (default)/60 Hz. 10 Output voltage 220/230(default)/240 V. 08 ECO 'SdS' off(default)/'SEn' on."),
        ("battery_type", "Battery type & charger priority",
         "05 Battery type: AGM(default) / FLd Flooded / USE User-Defined / LIA (LIA-protocol lithium) / PYL Pylontech / "
         "t9F Techfine / GrO Growatt / LIb (LIB-protocol lithium) / LIC (3rd-party lithium). Lithium/protocol types "
         "auto-set programs 26/27/29 (LIA also 24). 16 Charger source priority: 'CSO' Solar first / 'SNU' Solar+Utility"
         "(default) / 'OSO' Only Solar. In battery mode only solar charges."),
        ("charge_voltages", "Charging voltages",
         "26 Bulk/Constant-Voltage (CV) charge: 24 V-system default 28.2 V [24–30 V]; 48 V-system default 56.4 V "
         "[48–60 V]; 0.1 V steps (settable only if User-Defined). 27 Float charge: 24 V default 27.0 V; 48 V default "
         "54.0 V. 29 Low DC cut-off: 24 V default 21.0 V [20–26 V]; 48 V default 42.0 V [40–52 V]. 11 Max utility "
         "charging current: default 30 A, 2 A then 10 A–max, 10 A steps. CV must be higher than float."),
        ("thresholds", "Battery switch thresholds & alarms",
         "12 Voltage point back to utility (SBU priority): 24 V default 23.0 V [22–25.5 V, 0.5 V]; 48 V default 46 V "
         "[44–51 V, 1 V]. 13 Voltage point back to battery mode (SBU priority): 24 V 'FUL'/27.0 V [24–29 V]; 48 V "
         "'FUL'/54 V [48–58 V]. 24 Battery low-voltage alarm: 20–27 V (24 V system) / 40–54 V (48 V system). 18 Alarm "
         "control bON(default)/bOF. 22 Beeps when primary source interrupted AON(default)/AOF. 23 Overload bypass "
         "byd(default)/byE. 25 Record fault code FEN(default)/FdS. 19 Auto-return display ESP(default)/tEP. 20 Backlight LON/LOF."),
        ("equalization", "Battery equalization (lead-acid only)",
         "Only when Flooded or User-Defined in program 05. 30 Equalization EEn / EdS(default). 31 Equalization voltage: "
         "24 V default 29.2 V [24–30 V]; 48 V default 58.4 V [48–60 V]. 33 Equalized time 60 min [5–900]. 34 Equalized "
         "timeout 120 min [5–900]. 35 Equalization interval 30 days [0–90]. 36 Equalize immediately AEn/AdS(default) "
         "(LCD shows 'E9' while active). Do NOT equalize lithium batteries."),
        ("bms_soc", "BMS & SOC settings (lithium)",
         "37 BMS Function Switch OFF(default)/ON. 38 Battery SOC under-lock: default 10% — if BMS SOC drops below, the "
         "inverter shuts down to protect the battery. 39 Battery SOC turn-to-AC: default 20% — in battery-priority mode, "
         "forces mains charging when SOC below. 40 Battery SOC turn-to-DC: default 95% — resumes DC/battery mode when SOC "
         "above. 41 Battery restart SOC: default 50% — at power-on, SOC must exceed this to run."),
        ("gridtie", "Solar, grid-tie, scheduling & time",
         "43 Solar supply priority: 'bLU' charge battery first / 'LbU' power loads first. 44 Solar feed-to-grid: 'Grd' "
         "disable / 'GtE' enable. 45 Reset PV energy Nrt(default)/rSt. 46 AC-charger start time / 47 stop time [00:00–23:00]. "
         "48 Scheduled AC output ON / 49 OFF [00:00–23:00]. 50 Country regulations Mode1 Ind/Mode2 GEn/Mode3 SAd/Mode4 "
         "PAr(default) (feed-in V/freq ranges). 51–55 Time set min/hour/day/month/year. 56 Grid-tie current 10 A (1 A "
         "steps). 57 External CT function. 58 Mains input power 150 W [10–500 W]."),
        ("dual_output", "Dual (second) output",
         "60 Dual output L2F disable(default)/L2O use. 61 Dual-output functional voltage point: 48 V default 44.0 V / "
         "24 V default 22.0 V — second output cuts off below this (0.1 V steps). 62 Dual-output SOC point: default 15% "
         "(lithium) — cuts off below. 63 Dual battery voltage recover: default 52 V/26 V. 64 Dual battery SOC recover: "
         "default 50%/95%. 65 Discharge time on 2nd output: disable, 0–990 min [5 min]. 66 Dual recover delay 0–60 min. "
         "67 Output open time / 68 Output stop time [0–23]."),
    ],
    "heavy_duty": [
        ("output", "Output & input", _SET_HOWTO +
         "00 Exit setting mode: 'GOE' escape(default) / 'GOH' one-button restore settings. 01 Output source priority: "
         "'USb' Utility first / 'SUb' Solar first(default) / 'SbU' SBU (utility only when battery drops to the low-voltage "
         "warning or program-12 point). 02 Max total charging current: default 60 A, 10 A–140 A (130/140 A on 7.2 kW), "
         "10 A steps. 03 AC input voltage range 'APL'(90–280 VAC, default)/'UPS'(170–280 VAC). 09 Output frequency 50 Hz"
         "(default)/60 Hz. 10 Output voltage 220/230(default)/240 V. (HD has no ECO program 08.)"),
        ("battery_type", "Battery type & charger priority",
         "05 Battery type: AGM(default) / FLd Flooded / USE User-Defined / LIb lithium (set to LIB for a lithium battery; "
         "activates after 3 s). 16 Charger source priority: 'CSO' Solar first / 'SNU' Solar+Utility(default) / 'OSO' Only "
         "Solar. In battery/power-saving mode only solar charges. 11 Max utility charging current default 30 A [2 A,10–100 A]."),
        ("charge_voltages", "Charging voltages (by model)",
         "Model tiers: 3.6 kW = 24 V system; 6.2/7.2 kW = 48 V system. 26 Bulk/CV charge: 3.6 kW default 28.2 V "
         "[25.0–29.0 V]; 6.2/7.2 kW default 56.4 V [48.0–58.0 V]; 0.1 V steps (User-Defined only). 27 Float charge: "
         "3.6 kW default 27.0 V; 6.2/7.2 kW default 54.0 V (same ranges). 29 Low DC cut-off: 3.6 kW default 20.0 V "
         "[20.0–24.0 V]; 6.2/7.2 kW default 40.0 V [40.0–48.0 V]. CV must be higher than float."),
        ("thresholds", "Battery switch thresholds & alarms",
         "12 Voltage point back to utility (SBU/Solar-first): 3.6 kW default 23.0 V [21.0–25.5 V]; 6.2/7.2 kW default "
         "46 V [42–51 V]. 13 Voltage point back to battery (SBU/Solar-first): 3.6 kW 'FUL'/27.0 V [24–29 V]; 6.2/7.2 kW "
         "'FUL'/54.0 V [48–58 V]. 18 Alarm control bON(default)/bOF. 22 Beeps when primary source interrupted "
         "AON(default)/AOF. 23 Overload bypass byd(default)/byE. 25 Record fault code FEN(default)/FdS. 19 Auto-return "
         "display ESP(default)/tEP. 20 Backlight LON(default)/LOF."),
        ("equalization", "Battery equalization (lead-acid only)",
         "Only when Flooded or User-Defined in program 05. 30 Equalization EEn / EdS(default). 31 Equalization voltage: "
         "3.6 kW default 29.2 V [25.0–31.5 V]; 6.2/7.2 kW default 58.4 V [48.0–61.0 V]. 33 Equalized time 60 min [5–900]. "
         "34 Equalized timeout 120 min [5–900]. 35 Equalization interval 30 days [0–90]. 36 Equalize immediately "
         "AEn/AdS(default) (LCD shows 'E9'). Do NOT equalize lithium batteries."),
        ("gridtie_dual", "Grid-tie & dual output",
         "37 Grid-tie operation: 'OFF' off-grid(default, solar→loads then charge) / 'HYd' hybrid (solar→loads, charge, "
         "excess feeds to grid). 38 Grid-tie current 10 A (2 A steps). 39 LED pattern light LOF/LON(default). 41 Dual "
         "output L2F disable(default)/L2O use. 42 Dual-output functional voltage point: 3.6 kW(24 V) default 22.0 V "
         "[20.0–23.0 V]; 6.2/7.2 kW(48 V) default 44.0 V [40.0–46.0 V]; 0.1 V steps."),
    ],
}


def settings_doc(s, meta, key, title, body):
    nums = ",".join(__import__("re").findall(r"\b\d{2}\b", body)[:14])
    content = f"{meta['model_name']} ({s}) LCD SETTING — {title}. {body}"
    return {"title": f"{meta['model_name']} — Settings: {title}", "code_type": f"settings_{key}", "code": f"settings_{key}",
            "fault_code": "", "problem_summary": f"LCD setting programs — {title}.",
            "resolution_steps": _SET_HOWTO.strip(),
            "question": f"How do I set {title.lower()} on a {s.replace('_',' ')} inverter? (LCD setting programs)",
            "answer": body, "content": content,
            "keywords": f"display settings, setting, settings, program, programs, {title}, program {nums}, configure, {s}"}


def fault_doc(s, meta, code, meaning, todo):
    kws = f"Error {code}, Err {code}, Err{code}, fault {code}, fault code {code}, code {code}, {code} ERROR"
    content = (f"{meta['model_name']} ({s}) FAULT CODE {code} — {meaning}. Keywords: {kws}. "
               f"This is a FAULT: steady red Fault LED, the inverter STOPS and the LCD shows fault code {code}. "
               f"What to do: {todo}")
    return {"title": f"{meta['model_name']} — Fault {code}: {meaning}", "code_type": "fault", "code": code,
            "fault_code": f"Fault {code}", "problem_summary": f"Fault {code}: {meaning}.",
            "resolution_steps": todo,
            "question": f"What does Error {code} (fault code {code}) mean on a {s.replace('_',' ')} inverter?",
            "answer": f"Fault {code} = {meaning}. {todo}", "content": content,
            "keywords": f"{kws}, fault, inverter, {s}"}


def warn_doc(s, meta, code, meaning, audible, todo):
    kws = f"Error {code}, Warning {code}, Alarm {code}, code {code}, {code}"
    content = (f"{meta['model_name']} ({s}) WARNING/ALARM CODE {code} — {meaning}. Keywords: {kws}. "
               f"This is a WARNING (not a fault): red LED FLASHES, the inverter KEEPS RUNNING. "
               f"Audible: {audible}. What to do: {todo}")
    return {"title": f"{meta['model_name']} — Warning {code}: {meaning}", "code_type": "warning", "code": code,
            "fault_code": f"Warning {code}", "problem_summary": f"Warning {code}: {meaning}.",
            "resolution_steps": todo,
            "question": f"What does warning/alarm {code} mean on a {s.replace('_',' ')} inverter?",
            "answer": f"Warning {code} = {meaning}. {todo}", "content": content,
            "keywords": f"{kws}, warning, alarm, inverter, {s}"}


def coderef_doc(s, meta, code, meaning, todo):
    kws = f"code {code}, Error {code}, {code}, BMS code {code}"
    content = (f"{meta['model_name']} ({s}) BMS CODE {code} — {meaning}. Keywords: {kws}. "
               f"An informational LCD code shown for lithium batteries after a successful BMS handshake. {todo}")
    return {"title": f"{meta['model_name']} — BMS code {code}", "code_type": "coderef", "code": code,
            "fault_code": f"Code {code}", "problem_summary": f"BMS code {code}: {meaning}.",
            "resolution_steps": todo,
            "question": f"What does code {code} mean on a {s.replace('_',' ')} inverter with a lithium battery?",
            "answer": f"Code {code} = {meaning}. {todo}", "content": content,
            "keywords": f"{kws}, BMS, lithium, {s}"}


def troubleshooting_doc(s, meta):
    body = " | ".join(f"{p}: {d}" for p, d in TROUBLESHOOTING)
    return {"title": f"{meta['model_name']} — Troubleshooting", "code_type": "troubleshooting", "code": "troubleshooting",
            "fault_code": "", "problem_summary": "Field troubleshooting: no-start, runs-on-battery, relay clicking.",
            "resolution_steps": body,
            "question": f"Troubleshooting a {s.replace('_',' ')} inverter that won't start or misbehaves.",
            "answer": body, "content": f"{meta['model_name']} ({s}) TROUBLESHOOTING. {body}",
            "keywords": f"troubleshooting, not starting, won't turn on, dead, runs on battery, relay clicking, {s}"}


def parallel_doc(s, meta):
    body = " | ".join(f"{c} = {d}" for c, d in PARALLEL)
    return {"title": f"{meta['model_name']} — Parallel-system fault codes (multi-inverter installs)",
            "code_type": "parallel", "code": "parallel", "fault_code": "",
            "problem_summary": "Codes that appear only in parallel (multi-unit) installations.",
            "resolution_steps": "Apply only to parallel kits; check inter-unit cabling, firmware match, and phase/output settings.",
            "question": f"What do parallel-system codes (60/71/72/80–86) mean on a {s.replace('_',' ')} inverter?",
            "answer": body,
            "content": (f"{meta['model_name']} ({s}) PARALLEL-SYSTEM FAULT CODES (only in multi-inverter installs): "
                        f"{body}. Note: in a SINGLE-unit install these numbers instead carry their normal fault/BMS meaning."),
            "keywords": f"parallel, multi-unit, CAN fault, host loss, sync loss, current sharing, {s}"}


def build(s, meta):
    docs = ([fault_doc(s, meta, *f) for f in FAULTS]
            + [warn_doc(s, meta, *w) for w in WARNINGS]
            + [coderef_doc(s, meta, *c) for c in CODE_REF]
            + [settings_doc(s, meta, k, t, b) for (k, t, b) in SETTINGS.get(s, [])]
            + [troubleshooting_doc(s, meta)])
    if s == "titan":
        docs.append(parallel_doc(s, meta))
    return docs


def write_markdown(s, meta):
    L = [f"# {meta['model_name']} — Service Reference Notes", "",
         f"> Source: {meta['source']}. Shared knowledge for **Pratibha / Jasmine / Kalpana**. "
         "Generated by `scripts/ingest_axpert_kb.py` (also in `db.kb_articles`). Edit the script, not this file.",
         "",
         "> ⚠ Codes here are the **Axpert/Voltronic** set — DIFFERENT from the Focus/MG6500-48 set. "
         "E.g. here **52 = Bus voltage too low (fault)**, on Focus 52 = Battery low voltage (alarm). "
         "Always confirm the customer's series. LCD setting-program values are NOT included (manual OCR unreliable) — "
         "read setpoints off the unit or escalate; never quote a number.", "",
         "## Fault codes (steady red LED — inverter STOPS)", "",
         "| Code | Meaning | What to do |", "|---|---|---|"]
    L += [f"| {c} | {m} | {t} |" for (c, m, t) in FAULTS]
    L += ["", "## Warning / alarm codes (flashing red LED — inverter KEEPS RUNNING)", "",
          "| Code | Meaning | Audible | What to do |", "|---|---|---|---|"]
    L += [f"| {c} | {m} | {a} | {t} |" for (c, m, a, t) in WARNINGS]
    L += ["", "## BMS codes (lithium, after successful handshake)", "", "| Code | Meaning |", "|---|---|"]
    L += [f"| {c} | {m} |" for (c, m, t) in CODE_REF]
    L += ["", "## LCD setting programs", "", _SET_HOWTO.strip(), ""]
    for (k, t, b) in SETTINGS.get(s, []):
        L += [f"### {t}", "", b, ""]
    L += ["", "## Troubleshooting", ""]
    L += [f"- **{p}** — {d}" for p, d in TROUBLESHOOTING]
    if s == "titan":
        L += ["", "## Parallel-system fault codes (multi-inverter installs only)", ""]
        L += [f"- **{c}** — {d}" for c, d in PARALLEL]
    out_dir = os.path.join(os.path.dirname(__file__), "..", "knowledge")
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"{s}_series_reference.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"wrote {os.path.normpath(path)}")


def main():
    client = MongoClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    total = 0
    for s, meta in SERIES.items():
        write_markdown(s, meta)
        docs = build(s, meta)
        for d in docs:
            common = {"device_type": "inverter", "model_name": meta["model_name"], "series": s,
                      "aliases": meta["aliases"],
                      "tags": ["inverter", s, d["code_type"], d["code"]],
                      "status": "published", "source": meta["source"],
                      "for_brains": ["pratibha", "jasmine", "kalpana"], "updated_at": NOW}
            doc = {**common, **d}
            db.kb_articles.update_one(
                {"series": s, "code_type": d["code_type"], "code": d["code"]},
                {"$set": doc, "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": NOW}}, upsert=True)
            total += 1
        print(f"  {s}: ingested {len(docs)} articles")
    # series-disambiguation sanity check
    for s in ("titan", "focus"):
        a = db.kb_articles.find_one({"series": s, "code_type": {"$in": ["fault", "alarm"]}, "code": "52"},
                                    {"_id": 0, "title": 1})
        print(f"verify code 52 / {s}:", a)
    print(f"TOTAL upserted: {total}")
    client.close()


if __name__ == "__main__":
    main()
