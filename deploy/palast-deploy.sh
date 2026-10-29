#!/usr/bin/env bash
# Deployt die Palast App auf diesem Server – aufgerufen von GitHub Actions per SSH.
#
# Installation (einmalig, als root):
#   install -o root -g root -m 755 deploy/palast-deploy.sh /usr/local/bin/palast-deploy
# In ~deploy/.ssh/authorized_keys erzwingt der GitHub-Schlüssel genau dieses Skript:
#   restrict,command="/usr/local/bin/palast-deploy" ssh-ed25519 AAAA... github-actions-palast-deploy
# Das Skript liegt bewusst fest auf dem Server (root-eigen) und nicht im Repo-Klon,
# damit der Schlüssel nichts anderes ausführen kann als "einen Commit von main deployen".
#
# Ablauf: Commit holen → Datenbank sichern → frontend/ und backend/ nach APP_DIR kopieren
# → Container neu bauen → Health-Check → bei Fehler alten Stand zurückspielen.
# Dockerfile, docker-compose.yml, backup.sh und data/ in APP_DIR werden nie angefasst.
set -euo pipefail

SRC_DIR=/opt/palast-src     # Klon des GitHub-Repos (wird nur gelesen)
APP_DIR=/opt/palast-app     # Docker-Setup mit data/, Dockerfile, docker-compose.yml
BRANCH=main
HEALTH_URL=http://127.0.0.1:3000/api/flatmates
KEEP_DB_BACKUPS=30

log() { printf '[%s] %s\n' "$(date '+%F %T')" "$*"; }

# Nie zwei Deployments gleichzeitig
exec 9>"$APP_DIR/.deploy.lock"
flock -n 9 || { log "Es läuft schon ein Deployment."; exit 1; }

# Welcher Commit? GitHub übergibt die Commit-ID (landet bei command= in SSH_ORIGINAL_COMMAND),
# ohne Angabe wird der neueste Stand von main deployt. Nur Commits, die auf main liegen.
REQUESTED="${SSH_ORIGINAL_COMMAND:-${1:-}}"
git -C "$SRC_DIR" fetch --quiet origin "$BRANCH"
if [[ -z "$REQUESTED" ]]; then
    TARGET=$(git -C "$SRC_DIR" rev-parse "origin/$BRANCH")
elif [[ "$REQUESTED" =~ ^[0-9a-f]{40}$ ]]; then
    git -C "$SRC_DIR" merge-base --is-ancestor "$REQUESTED" "origin/$BRANCH" \
        || { log "Commit $REQUESTED liegt nicht auf $BRANCH – abgebrochen."; exit 1; }
    TARGET=$REQUESTED
else
    log "Ungültige Anfrage – erwartet wird eine Commit-ID."
    exit 1
fi
git -C "$SRC_DIR" checkout --quiet --force --detach "$TARGET"
log "Deploye $(git -C "$SRC_DIR" log -1 --format='%h %s')"

# Schutz vor Handänderungen: Der Code in APP_DIR muss genau dem zuletzt deployten Commit entsprechen
# (beim allerersten Lauf: dem Ziel-Commit). Wurde am Server direkt etwas geändert, brechen wir ab,
# statt es zu überschreiben – erst ins Repo committen, dann deployen. Root kann mit FORCE=1 übergehen.
BASE=$(cat "$APP_DIR/.deployed-commit" 2>/dev/null || echo "$TARGET")
CHECK_DIR=$(mktemp -d)
trap 'rm -rf "$CHECK_DIR"' EXIT
git -C "$SRC_DIR" archive "$BASE" frontend backend | tar -x -C "$CHECK_DIR"
DRIFT=$(for d in frontend backend; do
    diff -rq --exclude=node_modules --exclude='database.json*' --exclude='*.bak-*' \
        "$CHECK_DIR/$d" "$APP_DIR/$d" || true
done | sed "s#$CHECK_DIR#repo#g; s#$APP_DIR#server#g")
if [[ -n "$DRIFT" ]]; then
    if [[ "${FORCE:-}" != 1 ]]; then
        log "ABGEBROCHEN: Der Code auf dem Server weicht von Commit ${BASE:0:7} ab (Handänderung?):"
        printf '%s\n' "$DRIFT"
        log "Erst diese Änderungen ins Repo übernehmen, dann erneut deployen. Nichts wurde verändert."
        exit 1
    fi
    log "FORCE=1 – Abweichungen vom Repo werden überschrieben."
fi

# Datenbank sichern (die letzten KEEP_DB_BACKUPS bleiben liegen)
mkdir -p "$APP_DIR/data/backups"
if [[ -f "$APP_DIR/data/database.json" ]]; then
    cp -p "$APP_DIR/data/database.json" "$APP_DIR/data/backups/database-$(date +%Y%m%d-%H%M%S).json"
    ls -1t "$APP_DIR"/data/backups/database-*.json | tail -n +$((KEEP_DB_BACKUPS + 1)) | xargs -r rm --
fi

# Code kopieren – Daten, node_modules und Sicherungskopien (*.bak-*) bleiben unberührt
sync_code() {
    local from=$1 to=$2
    rsync -a --delete --exclude '*.bak-*' "$from/frontend/" "$to/frontend/"
    rsync -a --delete --exclude 'node_modules/' --exclude 'database.json*' --exclude '*.bak-*' \
        "$from/backend/" "$to/backend/"
}

build() { (cd "$APP_DIR" && docker compose up -d --build); }

healthy() {
    for _ in $(seq 1 30); do
        curl -fsS "$HEALTH_URL" 2>/dev/null | grep -q '"success":true' && return 0
        sleep 2
    done
    return 1
}

# Aktuellen Stand für ein Rollback merken
ROLLBACK="$APP_DIR/.deploy-rollback"
rm -rf "$ROLLBACK"
mkdir -p "$ROLLBACK"
sync_code "$APP_DIR" "$ROLLBACK"

sync_code "$SRC_DIR" "$APP_DIR"
if build && healthy; then
    echo "$TARGET" > "$APP_DIR/.deployed-commit"
    docker image prune -f >/dev/null 2>&1 || true
    log "Fertig – $(git -C "$SRC_DIR" log -1 --format='%h') läuft."
    exit 0
fi

log "Neuer Stand startet nicht – spiele den alten zurück."
sync_code "$ROLLBACK" "$APP_DIR"
if build && healthy; then
    log "Alter Stand läuft wieder. Das Deployment ist fehlgeschlagen."
else
    log "ACHTUNG: Auch das Rollback startet nicht – bitte manuell prüfen (docker compose logs)."
fi
exit 1
