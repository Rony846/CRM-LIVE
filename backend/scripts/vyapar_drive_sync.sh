#!/usr/bin/env bash
#
# Auto-pickup Vyapar backups from Google Drive and sync into the CRM.
# Finds the newest *.vyb in the Vyapar backup folder, unzips the SQLite, and runs the
# three idempotent sync scripts (party sync -> sales/purchases -> unbooked-receipt flag).
# Skips if the newest backup was already processed. Alerts the founder on failure.
#
# Point Vyapar's "Auto backup -> Google Drive" at the folder named by VYAPAR_BACKUP_REMOTE.
set -uo pipefail

REMOTE="${VYAPAR_BACKUP_REMOTE:-gdrive:VyaparBackups}"
BE="/var/www/crm/backend"
PY="$BE/venv/bin/python"
WORK="/var/backups/vyapar"
LOG="/var/log/vyapar-sync.log"
ALERT_TO="919560377363@c.us"
BRIDGE="http://127.0.0.1:3011/send"
mkdir -p "$WORK"

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }
notify() {
  python3 - "$ALERT_TO" "$1" "$BRIDGE" <<'PY' || true
import sys, json, urllib.request
to, msg, url = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    urllib.request.urlopen(urllib.request.Request(url, data=json.dumps({"to": to, "message": msg}).encode(),
        headers={"Content-Type": "application/json"}), timeout=20).read()
except Exception: pass
PY
}
fail() { log "FAILED: $*"; notify "⚠️ Vyapar→CRM sync failed: $*"; exit 1; }

log "=== vyapar drive sync start (remote=$REMOTE) ==="

# newest .vyb (rclone --format 'tp' = "<modtime>;<path>")
# Recursive: Vyapar organises backups into month subfolders (e.g. Jul-2026/…vyb).
latest=$(rclone lsf "$REMOTE" --include "*.vyb" --format "tp" -R 2>>"$LOG" | sort -r | head -1 | cut -d';' -f2)
[ -z "$latest" ] && { log "no .vyb found in $REMOTE (configure Vyapar auto-backup there)"; exit 0; }
base=$(basename "$latest")   # rclone copy flattens into $WORK/, so unzip/rm use the basename

marker="$WORK/.last_processed"
if [ -f "$marker" ] && [ "$(cat "$marker")" = "$latest" ]; then
  log "no new backup since last run ($latest)"; exit 0
fi

log "downloading $latest"
rclone copy "$REMOTE/$latest" "$WORK/" >>"$LOG" 2>&1 || fail "rclone download"
rm -rf "$WORK/extract" && mkdir -p "$WORK/extract"
unzip -o -q "$WORK/$base" -d "$WORK/extract" || fail "unzip"
vyp=$(ls "$WORK/extract"/*.vyp 2>/dev/null | head -1)
[ -z "$vyp" ] && fail "no .vyp inside $latest"

cd "$BE" || fail "cd backend"
log "party sync...";   "$PY" scripts/vyapar_party_sync.py "$vyp" --commit >>"$LOG" 2>&1 || fail "party sync"
log "txn import...";   "$PY" scripts/vyapar_txn_import.py "$vyp" --commit >>"$LOG" 2>&1 || fail "txn import"
log "unbooked flag..."; "$PY" scripts/flag_unbooked_dealer_receipts.py "$vyp" --commit >>"$LOG" 2>&1 || fail "unbooked flag"

echo "$latest" > "$marker"
rm -f "$WORK/$base"          # keep only the marker + extracted (small); drop the zip
log "=== DONE: synced $latest ==="
