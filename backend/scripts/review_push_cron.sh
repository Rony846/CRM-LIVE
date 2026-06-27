#!/bin/bash
# Daily Google-review drive batch — 125 delivered customers/day until the 500 queue drains.
# The Python script enforces the 9am–8pm IST send window and auto-stops when nothing is pending.
cd /var/www/crm/backend || exit 1
echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) review_push_delivered batch ===" >> /var/log/review_push.log
/var/www/crm/backend/venv/bin/python scripts/review_push_delivered.py send --confirm --limit 125 \
    >> /var/log/review_push.log 2>&1
