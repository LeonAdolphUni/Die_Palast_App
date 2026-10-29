#!/usr/bin/env bash
# Testet deploy/palast-deploy.sh ohne echten Server: docker und curl sind Attrappen, die Pfade
# zeigen in ein Temp-Verzeichnis. Läuft in GitHub Actions (braucht git, rsync, flock).
set -euo pipefail

REPO=$(cd "$(dirname "$0")/.." && pwd)
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
PASS=0

fail() { echo "FEHLER: $*"; exit 1; }
ok() { echo "ok – $*"; PASS=$((PASS + 1)); }

# Test-"GitHub" (bare repo) mit dem aktuellen Stand, Server-Klon und Arbeitskopie für neue Commits
git clone -q --bare "$REPO" "$T/origin.git"
git clone -q "$T/origin.git" "$T/src"
git clone -q "$T/origin.git" "$T/work"
git -C "$T/work" config user.email test@example.com
git -C "$T/work" config user.name Test
APP="$T/app"
mkdir -p "$APP/data"
echo '{"users":{}}' > "$APP/data/database.json"

# Live-Stand = aktueller Commit (so wie nach dem Übernehmen ins Repo)
git -C "$T/src" archive HEAD frontend backend | tar -x -C "$APP"

# Attrappen: docker tut nichts, curl ist "gesund", solange im Frontend kein KAPUTT steht
mkdir -p "$T/bin"
cat > "$T/bin/docker" <<'EOF'
#!/usr/bin/env bash
echo "docker $*" >> "$STUB_LOG"
EOF
cat > "$T/bin/curl" <<EOF
#!/usr/bin/env bash
grep -q KAPUTT "$APP/frontend/index.html" && exit 22
echo '{"success":true,"data":[]}'
EOF
printf '#!/usr/bin/env bash\nexit 0\n' > "$T/bin/sleep"
chmod +x "$T/bin/"*
export PATH="$T/bin:$PATH" STUB_LOG="$T/docker.log"

# Skript mit Test-Pfaden
sed -e "s#^SRC_DIR=.*#SRC_DIR=$T/src#" -e "s#^APP_DIR=.*#APP_DIR=$APP#" \
    "$REPO/deploy/palast-deploy.sh" > "$T/palast-deploy"
chmod +x "$T/palast-deploy"
deploy() { FORCE="${FORCE:-}" SSH_ORIGINAL_COMMAND="${1:-}" "$T/palast-deploy" > "$T/out.log" 2>&1; }

new_commit() {   # $1 = Text, der an frontend/index.html angehängt wird
    echo "<!-- $1 -->" >> "$T/work/frontend/index.html"
    git -C "$T/work" commit -qam "$1"
    git -C "$T/work" push -q origin HEAD:main
    git -C "$T/work" rev-parse HEAD
}

# 1. Erstes Deployment des aktuellen Stands (ohne Commit-ID)
deploy || { cat "$T/out.log"; fail "erstes Deployment"; }
[[ $(cat "$APP/.deployed-commit") == $(git -C "$T/src" rev-parse origin/main) ]] || fail ".deployed-commit"
grep -q "compose up -d --build" "$STUB_LOG" || fail "docker compose wurde nicht aufgerufen"
ls "$APP"/data/backups/database-*.json >/dev/null || fail "kein Datenbank-Backup"
ok "erstes Deployment, Datenbank gesichert"

# 2. Neuer Commit mit Commit-ID, Sicherungskopie im Backend bleibt liegen
echo alt > "$APP/backend/server.js.bak-2026"
C2=$(new_commit "Version 2")
deploy "$C2" || { cat "$T/out.log"; fail "Folge-Deployment"; }
grep -q "Version 2" "$APP/frontend/index.html" || fail "neuer Stand nicht kopiert"
[[ -f "$APP/backend/server.js.bak-2026" ]] || fail "*.bak-* wurde gelöscht"
[[ $(cat "$APP/.deployed-commit") == "$C2" ]] || fail ".deployed-commit nach Update"
ok "Folge-Deployment, *.bak-* bleibt erhalten"

# 3. Handänderung am Server → Abbruch, nichts wird überschrieben
echo "// von Hand" >> "$APP/backend/server.js"
C3=$(new_commit "Version 3")
if deploy "$C3"; then fail "Deployment trotz Handänderung"; fi
grep -q "ABGEBROCHEN" "$T/out.log" || fail "keine Abbruch-Meldung"
grep -q "server.js" "$T/out.log" || fail "Abweichung nicht genannt"
grep -q "von Hand" "$APP/backend/server.js" || fail "Handänderung überschrieben"
grep -q "Version 3" "$APP/frontend/index.html" && fail "trotz Abbruch kopiert"
ok "Handänderung wird erkannt, nichts überschrieben"

# 4. Mit FORCE=1 (nur root von Hand) wird trotzdem deployt
FORCE=1 deploy "$C3" || { cat "$T/out.log"; fail "FORCE-Deployment"; }
grep -q "von Hand" "$APP/backend/server.js" && fail "FORCE hat nicht überschrieben"
ok "FORCE=1 überschreibt bewusst"

# 5. Neuer Stand startet nicht → Rollback auf den alten
C4=$(new_commit "KAPUTT")
if deploy "$C4"; then fail "kaputter Stand als Erfolg gemeldet"; fi
grep -q "Alter Stand läuft wieder" "$T/out.log" || { cat "$T/out.log"; fail "kein Rollback"; }
grep -q "KAPUTT" "$APP/frontend/index.html" && fail "kaputter Stand ist noch da"
[[ $(cat "$APP/.deployed-commit") == "$C3" ]] || fail ".deployed-commit nach Rollback"
ok "Rollback, wenn der neue Stand nicht startet"

# 6. Ungültige Anfragen
if deploy "rm -rf /"; then fail "Befehl statt Commit-ID akzeptiert"; fi
grep -q "Ungültige Anfrage" "$T/out.log" || fail "keine Meldung bei ungültiger Anfrage"
git -C "$T/work" checkout -qb nebenzweig
echo x >> "$T/work/README.md"
git -C "$T/work" commit -qam "nicht auf main"
git -C "$T/work" push -q origin nebenzweig
if deploy "$(git -C "$T/work" rev-parse HEAD)"; then fail "Commit außerhalb von main deployt"; fi
grep -q "liegt nicht auf main" "$T/out.log" || fail "keine Meldung bei fremdem Commit"
ok "ungültige Anfragen und Commits außerhalb von main werden abgewiesen"

echo "Alle $PASS Tests bestanden."
