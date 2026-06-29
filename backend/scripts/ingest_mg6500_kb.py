"""Ingest the MG6500-48 (Focus 6.2 kW) manual into the shared agent knowledge base.

Source: Files-for-Claude #197 `User_Manual_MG6500-48__1_.pdf` (47 pp).
Goal: Pratibha / Jasmine / Kalpana must never be wrong about this model's fault codes,
alarm codes, or display settings. We write to db.kb_articles (the collection the support
agents query via search_knowledge_base) AND emit a human-readable reference doc.

Idempotent: upserts on (model_name, code_type, code) so re-running just refreshes content.
Run:  cd backend && python scripts/ingest_mg6500_kb.py
"""
import os
import sys
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

MODEL = "MG6500-48"
ALIASES = ["MG6500-48", "Focus 6.2kW", "Focus 6.2 kW", "Focus 6.2KW", "6.5kW", "6500W", "MPPT Solar Inverter"]
SOURCE = "User Manual MG6500-48 (Files-for-Claude #197)"
NOW = datetime.now(timezone.utc).isoformat()

# (code, name, trigger, resume) — LED solid red, inverter enters FAULT mode, LCD shows "Err <code>".
FAULTS = [
    ("1",  "Bus boost fail",        "Grid soft-start begins but bus voltage does not reach the set value", "Restores after reaching set voltage for 15 s"),
    ("2",  "Bus over voltage",      "Bus voltage higher than set value", "Restores after reaching set voltage for 15 s"),
    ("3",  "Bus below voltage",     "Bus voltage lower than set value", "Cannot restore (service required)"),
    ("4",  "Battery over current",  "Battery current higher than set value", "Cannot restore (service required)"),
    ("5",  "System over temperature","PFC temperature higher than set value OR fan not connected", "Restores after temperature falls below set value and fan connected for 15 min"),
    ("6",  "Battery over voltage",  "Battery voltage higher than set value", "Restores after reaching set voltage for 15 s"),
    ("7",  "Bus soft start failed", "Battery soft-start begins but bus voltage not reached", "Restores after reaching set voltage for 15 s"),
    ("8",  "Bus short circuit",     "Bus voltage lower than set value", "Cannot restore (service required)"),
    ("9",  "Inverter soft start failed","Inverter soft-start begins but inverter voltage not reached", "Restores after reaching set voltage for 15 s"),
    ("11", "Inverter under voltage","Inverter voltage lower than set value in battery mode", "Restores after reaching set voltage for 15 s"),
    ("12", "Inverter short circuit","Inverter voltage < set value AND current > set value", "Restores after reaching set value for 15 s"),
    ("13", "Inverter negative power","Inverter power negative and exceeds set value for a period", "Restores after reaching set value for 15 s"),
    ("14", "Over load",             "Load current higher than set value (continuous over-current 5 s, e.g. discharge over Program 61 limit)", "Restores after reaching set value for 15 s"),
    ("17", "Program updating",      "Inverter firmware updating / OTA in progress", "Restores after updating"),
    ("18", "PV reverse connection", "PV array connected with reversed polarity", "Restores after connecting correctly for 15 s"),
    ("26", "BMS fault",             "Error code present in BMS message", "Restores after the BMS fault is resolved"),
    ("29", "Inverter load abnormal","Abnormal inverter load drives abnormal voltage", "Restores after voltage returns to normal for 15 s"),
]

# (code, name, action, trigger, resume) — LED red FLASHING, NOT fault mode, LCD shows "ALA <code>".
ALARMS = [
    ("50", "Battery open",            "Alarm", "Battery disconnected for no more than 10 minutes", "Restores after battery reconnected and charging for 2 min"),
    ("51", "Battery under voltage",   "Alarm; battery low-voltage shutdown / cannot power on", "Battery voltage lower than the BAU set value (Program 19)", "Restores after battery voltage exceeds the BAU set value by 2 V"),
    ("52", "Battery low voltage",     "Alarm", "Battery voltage lower than the BAL set value (Program 18)", "Restores after battery voltage exceeds the BAL set value by 2 V"),
    ("53", "Battery charge short circuit","Alarm; battery does not charge", "Battery voltage < 12 V while charging current exists", "Restores after max 1 min once the short circuit is eliminated"),
    ("56", "BMS loss",                "Alarm", "Communication failure after BMS communication function (Program 44) is enabled", "Restores after BMS comms disabled or communication succeeds"),
    ("58", "Fan error",              "Alarm; fans run at full speed", "No fan-speed signal detected (fan rotating < 8 times in 2 s)", "Restores after a fan-speed signal is detected"),
    ("59", "EEPROM error",            "Alarm", "EEPROM read/write exception", "Cannot restore (service required)"),
    ("60", "Overload",                "Alarm", "Mains current / battery discharge current / load power higher than rated value", "Restores after it falls below the rated value"),
    ("62", "PV energy weak",          "Alarm; PV output to load turned off but PV keeps charging battery", "With no battery connected, bus voltage lower than set value", "Restores after battery connected, or grid connected, or 10 min later"),
    ("68", "Battery under SOC shutdown","Alarm; unit goes to standby", "BMS reports SOC lower than the BSU set value (Program 46)", "Restores when: low-SOC shutdown disabled, OR BMS comms disabled, OR SOC rises to set value + 5%"),
    ("69", "Battery below SOC warning","Alarm; stays in standby if already in standby", "Lithium SOC lower than set + 5% (grid/battery mode) or set + 10% (standby)", "Restores when: low-SOC shutdown disabled, OR BMS comms disabled, OR SOC rises to set value + 10%"),
    ("72", "Battery can not startup", "Alarm", "During standby, battery voltage lower than the allowed startup voltage", "Restores after battery voltage rises above the allowed startup voltage"),
    ("77", "Grid power is unstable",  "Alarm", "Lost grid power three times within 5 minutes", "Restores after 5 minutes"),
]

# (program, name, display, default, options/range, notes)
SETTINGS = [
    ("01", "Output voltage", "OPU230", "230 V", "208 / 220 / 230 / 240 V", "At 208 V the rated output power is reduced to 90%."),
    ("02", "Output frequency", "OPF 50", "50 Hz", "50 / 60 Hz", ""),
    ("03", "Output source priority", "OPP…", "Grid first", "Grid first / Solar first / PBG / MKS (generator)",
     "Grid first: grid powers loads, solar charges battery. Solar first: solar powers loads first. PBG: solar→battery→grid order. MKS: generator priority."),
    ("04", "Input mode", "nOd APP", "APP", "APP (appliances ~10 ms) / UPS (computers ~10 ms) / GEN (generator AC-in ~20 ms)", ""),
    ("05", "Charger source priority", "CHP PNG", "PNG (PV+Grid)", "PNG = PV and grid together / OPV = only PV / PVF = PV first", ""),
    ("06", "Grid charging current", "ICC 80", "80 A", "2/10/20/30/40/50/60/70/80/90/100/110/120/130/140/150/160 A", ""),
    ("07", "Maximum charging current (PV+grid total)", "nCC120", "120 A", "2…160 A (same steps as Program 06)", ""),
    ("08", "Menu default (auto-return to first page)", "ndF ON", "ON", "ON / OFF", "ON: return to first page after 1 min idle."),
    ("09", "Auto restart on overload", "LFS ON", "ON", "ON / OFF", ""),
    ("10", "Auto restart on over-temperature", "EFS ON", "ON", "ON / OFF", ""),
    ("11", "Main input cut warning", "nIP ON", "ON", "ON / OFF", "ON: buzzer sounds 5 s when grid/PV input is lost."),
    ("12", "Energy-saving mode", "PvS OFF", "OFF", "ON / OFF", "ON: in battery mode, output stops if load < 25 W and loops; resumes if load > 35 W."),
    ("13", "Overload transfer to bypass", "OL OFF", "OFF", "ON / OFF", "ON: in PBG/MKS mode, transfer to bypass (grid) on overload."),
    ("14", "Silent mode", "nUE OFF", "OFF", "ON / OFF", "ON: buzzer stays silent on alarms/faults (button sound unaffected)."),
    ("15", "Battery return-to-grid voltage point", "bELi230", "AGM/FLD 23 V; LIB 23.8 V; FEL 24.8 V; CUS 23.8 V", "AGM/FLD [22,26]; LIB/FEL/CUS [20,25]", "⚠ Values shown are 24 V-system; on this 48 V unit the real setpoint is ~2×."),
    ("16", "Switch-back-to-battery voltage point", "bELi260", "AGM/FLD 26 V; LIB 27.2 V; FEL 26.2 V; CUS 27.2 V", "AGM/FLD [24,29]; LIB/FEL/CUS [23,29]", "⚠ 24 V-system values; ~2× on this 48 V unit."),
    ("17", "Battery type", "bAL…", "AGM", "AGM / FLD (flooded) / LIB (ternary lithium) / FEL (lithium iron) / CUS (user-defined)", "Set LIB or FEL to enable BMS comms (see Program 44)."),
    ("18", "Battery low voltage point (BAL → Alarm 52)", "bALU220", "LIB 23.8 V; FEL 24 V; CUS = LIB; AGM/FLD 22 V (fixed)", "LIB/FEL [20.6,25]", "This is the threshold that raises Alarm 52. ⚠ 24 V-system value."),
    ("19", "Battery shutdown voltage point (BAU → Alarm 51)", "bALU210", "LIB 23 V; FEL 21 V; AGM/FLD 21 V (fixed); CUS = LIB", "LIB/FEL [20,24]", "Threshold for Alarm 51 / shutdown. ⚠ 24 V-system value."),
    ("20", "Constant-voltage (CV) charge set point", "bCU28.2", "AGM 28.2 V (fixed); FLD 29 V; LIB 28.2 V; FEL 27.6 V; CUS 56.4 V", "LIB/FEL/CUS [24,30]", "CV must be higher than float (Program 21). Note CUS default 56.4 V confirms this is really a 48 V system."),
    ("21", "Float charge set point", "bFL270", "AGM/FLD 27 V (fixed); CUS 27.6 V; LIB 27.6 V; FEL 27.2 V", "CUS [24,30]; LIB/FEL [25,29]", "Float must be lower than CV (Program 20)."),
    ("22", "Grid low-voltage point", "LL154", "APP/GEN 154 V; UPS 185 V", "APP/GEN [90,154]; UPS [170,200]", ""),
    ("23", "Grid high-voltage point", "LHU264", "264 V", "APP/GEN [264,280]; UPS fixed 264 V", ""),
    ("24", "Auto turn-off backlight", "AEb ON", "ON", "ON / OFF", "ON: backlight off after 1 min idle."),
    ("25", "Inverter soft start", "SFE OFF", "OFF", "ON / OFF", "ON: output ramps 0→target gradually. Single-machine mode only."),
    ("26", "Reset to factory settings", "SEd OFF", "OFF", "ON / OFF", "Set ON to restore defaults. Cannot be set in battery mode."),
    ("29", "Battery disconnection alarm", "SbA OFF", "OFF", "ON / OFF", "OFF: no alarm when battery disconnected."),
    ("31", "Equalization voltage point", "EQU292", "FEL 28 V; AGM/FLD/LIB/CUS 29.2 V", "[24,30]", "⚠ Do NOT use equalization on lithium batteries."),
    ("32", "Equalization charging time", "EQEOFF", "OFF", "OFF or [5,900] min (5-min steps)", ""),
    ("33", "Equalization delay (timeout)", "EQd120", "120 min", "[5,900] min (5-min steps)", ""),
    ("34", "Equalization interval", "EQi 30", "30 days", "[1,90] days", ""),
    ("35", "Enable equalization immediately", "EQnOFF", "OFF", "ON / OFF", ""),
    ("36", "Grid-tie (feed-in) function", "GEi OFF", "OFF", "OFF / INT", "INT: PV surplus feeds to grid per output-source priority."),
    ("37", "Max grid-tie power", "GEP 50", "5.0 kW", "[0,5.0] kW (0.5 kW steps)", ""),
    ("38", "Dual-output low-voltage shutdown point", "db240", "24 V", "[22,30] V", "Only models with a second AC output. ⚠ 24 V-system value."),
    ("39", "Dual-output duration", "dbEFUL", "OFF", "[5,900] min or FUL (unlimited)", "Only models with a second output."),
    ("40", "Dual-output battery-mode cut-off SOC", "dbS 20", "20%", "[5,90] or OFF", "Only models with a second output."),
    ("44", "BMS communication function", "bnSOFF", "OFF", "CVT / PYL / GRO / VOL / IRO / PAR", "PYL=PYLON, GRO=GROWATT (485+CAN); others 485. If comms abnormal → Alarm 56."),
    ("45", "BMS ID", "bnI AtO", "Auto (AtO)", "AtO or [0,15] (A–F = 10–15)", ""),
    ("46", "Low SOC shutdown (BSU)", "bSU 20", "20%", "[5,50]", "SOC at set value → shutdown + Alarm 68. Standby restart needs set + 10% else Alarm 69."),
    ("47", "High SOC → battery", "SEb 90", "90%", "[10,100]", "PBG mode: switch to battery when SOC reaches set value."),
    ("48", "Low SOC → grid", "SEG 50", "50%", "[10,90]", "PBG mode: switch to grid when SOC falls below set value."),
    ("61", "Battery max discharge current", "ndC190", "190 A", "[10,190] A (5 A steps) or OFF", "Over limit → Alarm 60; if continuous over-current 5 s → Fault 14."),
]

DISPLAY_PAGES = [
    ("P1", "Daily solar power generation (kWh)"),
    ("P2", "Total solar power generation (kWh)"),
    ("P3", "Lithium battery voltage and current (shows ERR if BMS comms fail; hidden if BMS disabled)"),
    ("P4", "Lithium battery temperature and SOC"),
    ("P5", "Lithium battery rated and remaining capacity"),
    ("P6", "Lithium battery max charge voltage and min discharge voltage"),
    ("P7", "Lithium battery max charge current and max discharge current"),
    ("P8", "Lithium battery alarm and fault info (NUL = none)"),
    ("P9", "Inverter firmware version"),
]

LEDS = [
    ("AC (green)", "Solid = mains normal and in mains operation; Flashing = mains normal but not yet in mains operation; Off = mains abnormal"),
    ("Inverter (yellow)", "Solid = output powered by battery or PV (battery mode); Off = other states"),
    ("Charging (yellow)", "Solid = float charging; Flashing = constant-voltage charging; Off = other states"),
    ("Fault (red)", "Solid = fault; Flashing = warning/alarm; Off = working normally"),
]

TROUBLESHOOTING = [
    ("Fault 5 — over temperature", "Check the fan: not connected or loose wiring. A disconnected fan for >5 min triggers Fault 5."),
    ("Fault 12 — inverter short circuit", "Check output terminals for a short (e.g. a screw piercing the LN). Triggers when inverter V < 80 V and current > 30 A within 100–120 ms."),
    ("Fault/Alarm 58 — fan malfunction", "Fan rotating < 8 times in 2 s. Check fan connection; if connected, check the fan-detection circuit (cold-solder under the control-board socket) or a damaged fan."),
    ("Unable to start — battery", "Needs ≥ 11.5 V per cell to start in battery mode. Causes: bad calibration or low battery voltage. Verify voltage sampling/calibration and measure terminal voltage. CRITICAL: set the battery voltage to match the machine model — the wrong battery voltage can cause a capacitor explosion."),
    ("Unable to start — utility power", "Check for a mains-terminal short (screw piercing live/neutral) and wiring errors (mains input wired to the output terminals)."),
    ("Unable to start — PV", "Check PV input voltage isn't too close to the threshold; for low-voltage versions verify control-board firmware compatibility."),
    ("PV not charging", "Wrong battery voltage can damage the PV-side auxiliary supply, losing comms with the main control."),
]

CAVEAT = (
    "CRITICAL CAVEAT for MG6500-48 (Focus 6.2 kW): the manual's setting tables print 24 V-system "
    "voltage numbers (e.g. 23 V, 28.2 V), but this is a 48 V unit — the CUS constant-voltage default of "
    "56.4 V (exactly 2×28.2) confirms it. Therefore: error/alarm CODE MEANINGS and behaviours are reliable, "
    "but DO NOT quote absolute voltage setpoints from the manual to a 48 V customer — the real values are ~2× "
    "(e.g. CV ≈ 56.4 V, float ≈ 54.4 V). When in doubt, read the value off the unit's own LCD or escalate; "
    "never invent a number."
)


def fault_doc(code, name, trigger, resume):
    kws = f"Error {code}, Err {code}, Err{code}, fault {code}, fault code {code}, code {code}, E{code}"
    content = (f"{MODEL} (Focus 6.2 kW) FAULT CODE {code} — {name}. "
               f"Keywords: {kws}. The inverter enters FAULT mode (steady red Fault LED, LCD shows 'Err {code}'). "
               f"Trigger: {trigger}. Recovery: {resume}. "
               f"In fault mode the unit auto-retries; after 6 failed restarts it stays in fault — power off fully "
               f"(or wait 30 min) to restart. If it persists, escalate to service.")
    return {
        "title": f"{MODEL} (Focus 6.2 kW) — Fault {code}: {name}",
        "code_type": "fault", "code": code, "fault_code": f"Err {code}",
        "problem_summary": f"Fault {code}: {name} — {trigger}.",
        "resolution_steps": f"{resume}. Auto-retries; after 6 fails, power off fully or wait 30 min. Persisting → service.",
        "question": f"What does Error {code} (Err {code}) mean on a Focus 6.2 kW / MG6500-48 inverter?",
        "answer": f"Fault {code} = {name}. {trigger}. {resume}.",
        "content": content, "keywords": f"{kws}, {name}, fault, inverter, focus 6.2kw",
    }


def alarm_doc(code, name, action, trigger, resume):
    kws = f"Error {code}, Err {code}, Alarm {code}, ALA {code}, ALA{code}, code {code}, warning {code}"
    content = (f"{MODEL} (Focus 6.2 kW) ALARM CODE {code} — {name}. "
               f"Keywords: {kws}. This is an ALARM, NOT a fault (red Fault LED flashes, LCD shows 'ALA {code}', "
               f"the inverter keeps running). Action: {action}. Trigger: {trigger}. Recovery: {resume}.")
    return {
        "title": f"{MODEL} (Focus 6.2 kW) — Alarm {code}: {name}",
        "code_type": "alarm", "code": code, "fault_code": f"ALA {code}",
        "problem_summary": f"Alarm {code}: {name} — {trigger}.",
        "resolution_steps": f"{resume}. Action: {action}.",
        "question": f"What does Alarm {code} (ALA {code} / Error {code}) mean on a Focus 6.2 kW / MG6500-48 inverter?",
        "answer": f"Alarm {code} = {name}. {trigger}. {resume}.",
        "content": content, "keywords": f"{kws}, {name}, alarm, inverter, focus 6.2kw",
    }


def settings_doc():
    lines = [f"Program {p} — {name} (display '{disp}'): default {default}; options {opts}. {notes}".strip()
             for (p, name, disp, default, opts, notes) in SETTINGS]
    body = " | ".join(lines)
    kws = ("Keywords: display settings, display setting, settings, setting, menu settings, configuration, "
           "configure, programs, program, parameter setting, change voltage, charging current, battery type, "
           "SOC settings, BMS settings, grid-tie, equalization. ")
    content = (f"{MODEL} (Focus 6.2 kW) LCD SETTING PROGRAMS / DISPLAY SETTINGS. {kws}Enter setup: hold ENTER 2 s; "
               f"UP/DOWN to pick a program; ENTER to confirm; ESC to exit. {CAVEAT} PROGRAMS: {body}")
    return {
        "title": f"{MODEL} (Focus 6.2 kW) — LCD Setting Programs (01–61)",
        "code_type": "settings", "code": "settings", "fault_code": "",
        "problem_summary": "Full list of LCD setting programs (output, charging, battery type, BMS, SOC, equalization, grid-tie).",
        "resolution_steps": "Hold ENTER 2 s to enter setup, UP/DOWN to select program, ENTER to confirm, ESC to exit.",
        "question": "How do I configure the display settings / programs on a Focus 6.2 kW / MG6500-48 inverter?",
        "answer": body,
        "content": content,
        "keywords": "display settings, settings, configuration, programs, battery type, charging current, voltage setpoint, BMS, SOC, equalization, grid-tie, focus 6.2kw",
    }


def display_doc():
    body = " | ".join(f"{p}: {d}" for p, d in DISPLAY_PAGES)
    leds = " | ".join(f"{l}: {d}" for l, d in LEDS)
    content = (f"{MODEL} (Focus 6.2 kW) DISPLAY INFORMATION & LED INDICATORS. Keywords: display settings, display, "
               f"LED lights, light blinking, red light, green light, what does the light mean, screen pages, icons. "
               f"Press UP/DOWN to cycle info pages: {body}. LED INDICATORS: {leds}. LCD charge-stage icons: "
               f"CC=constant current, CV=constant voltage, FLOAT=float charging.")
    return {
        "title": f"{MODEL} (Focus 6.2 kW) — Display Pages & LED Indicators",
        "code_type": "display", "code": "display", "fault_code": "",
        "problem_summary": "Info pages P1–P9 and what each LED (AC/Inverter/Charging/Fault) means.",
        "resolution_steps": "Press UP/DOWN to cycle the P1–P9 information pages.",
        "question": "What do the display pages and LED lights mean on a Focus 6.2 kW / MG6500-48 inverter?",
        "answer": f"{body}. LEDs: {leds}",
        "content": content,
        "keywords": "display, LED, light, red light, green light, blinking, flashing, screen, icons, P1 P2 P3, focus 6.2kw",
    }


def troubleshooting_doc():
    body = " | ".join(f"{p}: {d}" for p, d in TROUBLESHOOTING)
    content = f"{MODEL} (Focus 6.2 kW) TROUBLESHOOTING. {body}. {CAVEAT}"
    return {
        "title": f"{MODEL} (Focus 6.2 kW) — Troubleshooting",
        "code_type": "troubleshooting", "code": "troubleshooting", "fault_code": "",
        "problem_summary": "Field troubleshooting for over-temp, inverter short, fan, no-start (battery/utility/PV), PV-not-charging.",
        "resolution_steps": body,
        "question": "Troubleshooting steps for a Focus 6.2 kW / MG6500-48 inverter that won't start or shows a fault.",
        "answer": body,
        "content": content,
        "keywords": "troubleshooting, not starting, won't turn on, dead, no display, fan, over temperature, short circuit, PV not charging, focus 6.2kw",
    }


def write_markdown():
    """Emit the canonical human + agent reference doc from the same data."""
    L = [f"# {MODEL} (Focus 6.2 kW) — Service Reference Notes",
         "",
         f"> Source: {SOURCE}. Shared knowledge for **Pratibha / Jasmine / Kalpana**. "
         "Generated by `scripts/ingest_mg6500_kb.py` (also ingested into `db.kb_articles`). Do not hand-edit; edit the script.",
         "",
         "## ⚠ Critical caveat (read first)", "", CAVEAT, "",
         "## Fault codes (LCD `Err <code>`, steady red Fault LED — inverter STOPS)", "",
         "Auto-retries; after 6 failed restarts it latches — power off fully or wait 30 min. | "
         "Codes marked *Cannot restore* need service.", "",
         "| Code | Meaning | Trigger | Recovery |", "|---|---|---|---|"]
    L += [f"| {c} | {n} | {t} | {r} |" for (c, n, t, r) in FAULTS]
    L += ["", "## Alarm codes (LCD `ALA <code>`, flashing red LED — inverter KEEPS RUNNING)", "",
          "| Code | Meaning | Action | Trigger | Recovery |", "|---|---|---|---|---|"]
    L += [f"| {c} | {n} | {a} | {t} | {r} |" for (c, n, a, t, r) in ALARMS]
    L += ["", "## LCD setting programs (hold ENTER 2 s → UP/DOWN → ENTER → ESC)", "",
          "| # | Setting | Display | Default | Options / range | Notes |", "|---|---|---|---|---|---|"]
    L += [f"| {p} | {n} | `{d}` | {df} | {o} | {nt} |" for (p, n, d, df, o, nt) in SETTINGS]
    L += ["", "## Display info pages (UP/DOWN to cycle)", ""]
    L += [f"- **{p}** — {d}" for p, d in DISPLAY_PAGES]
    L += ["", "## LED indicators", ""]
    L += [f"- **{l}** — {d}" for l, d in LEDS]
    L += ["", "## Troubleshooting", ""]
    L += [f"- **{p}** — {d}" for p, d in TROUBLESHOOTING]
    L += ["", "## LCD charge-stage icons", "",
          "- **CC** = constant current · **CV** = constant voltage · **FLOAT** = float charging", ""]
    out_dir = os.path.join(os.path.dirname(__file__), "..", "knowledge")
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, "MG6500-48_Focus_6.2kW_reference.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"wrote reference doc: {os.path.normpath(path)}")


def main():
    write_markdown()
    client = MongoClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    docs = ([fault_doc(*f) for f in FAULTS]
            + [alarm_doc(*a) for a in ALARMS]
            + [settings_doc(), display_doc(), troubleshooting_doc()])

    n_up = 0
    for d in docs:
        common = {
            "device_type": "inverter", "model_name": MODEL, "series": "focus", "aliases": ALIASES,
            "tags": ["inverter", "focus 6.2kw", "mg6500-48", d["code_type"], d["code"]],
            "status": "published", "source": SOURCE, "for_brains": ["pratibha", "jasmine", "kalpana"],
            "updated_at": NOW,
        }
        doc = {**common, **d}
        res = db.kb_articles.update_one(
            {"model_name": MODEL, "code_type": d["code_type"], "code": d["code"]},
            {"$set": doc, "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": NOW}},
            upsert=True,
        )
        n_up += 1 if (res.upserted_id or res.modified_count) else 0
    print(f"kb_articles: upserted/updated {n_up}/{len(docs)} MG6500-48 articles "
          f"({len(FAULTS)} faults, {len(ALARMS)} alarms, 3 reference).")

    # sanity: the exact query the support agent runs for "52"
    hit = db.kb_articles.find_one(
        {"model_name": MODEL, "$or": [{"content": {"$regex": "Alarm 52", "$options": "i"}}]},
        {"_id": 0, "title": 1})
    print("verify 'Alarm 52' retrievable:", hit)
    client.close()


if __name__ == "__main__":
    main()
