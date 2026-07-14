#!/usr/bin/env bash
# P5 — clean rebuild + verify. Run from the project folder:  bash run.sh
set -u

echo "=== 1. Python ==="
python3 --version || { echo "FAIL: no python3"; exit 1; }

echo
echo "=== 2. Flask ==="
if python3 -c "import flask" 2>/dev/null; then
    python3 -c "import flask; print('flask', flask.__version__)"
else
    echo "Flask missing. Installing..."
    pip3 install flask || pip3 install flask --break-system-packages
fi

echo
echo "=== 3. Files present? ==="
missing=0
for f in schema.sql seed.py app.py triage_rules.py test_e2e.py; do
    if [ -f "$f" ]; then echo "  ok   $f"; else echo "  MISS $f"; missing=1; fi
done
[ "$missing" -eq 1 ] && { echo "FAIL: files missing — are you in the right folder?"; exit 1; }

echo
echo "=== 4. Rebuild DB ==="
rm -rf __pycache__ ed.db
python3 - <<'PY' || exit 1
import sqlite3
c = sqlite3.connect("ed.db")
c.executescript(open("schema.sql").read())
c.commit(); c.close()
print("  schema OK")
PY

echo
echo "=== 5. Seed ==="
python3 seed.py || exit 1

echo
echo "=== 6. End-to-end tests ==="
python3 test_e2e.py || exit 1

echo
echo "=============================================="
echo "  Setup complete."
echo
echo "  Start the API:   python3 app.py"
echo "                   http://127.0.0.1:5000/api/health"
echo
echo "  Open the UI:     open wireframes.html"
echo "                   (a static file — do NOT serve via Flask)"
echo "=============================================="
