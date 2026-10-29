# Die Palast App 🏰

Eine hochwertige, minimalistische Webanwendung zur Verwaltung des WG-Lebens. Inspiriert vom Apple Design-System (iOS/macOS), bietet diese App eine intuitive Lösung für Putzpläne, Einkaufslisten und WG-Finanzen.

## 🚀 Features

### 🧹 Intelligenter Putzplan
- **Automatisierte Rotation:** Aufgaben werden wöchentlich fair zwischen allen Mitbewohnern aufgeteilt.
- **Wochen-Lock:** Aufgaben können nur für die aktuelle Woche abgehakt werden.
- **Transparenz:** Sieh jederzeit, wer welche Aufgabe hat und was bereits erledigt wurde.

### 🛒 Gemeinsame Einkaufsliste
- **Echtzeit-Liste:** Alle Mitbewohner können Produkte hinzufügen.
- **Einfaches Abhaken:** Erledigte Einkäufe werden sofort für alle aktualisiert.

### 💶 Finanzen & Ausgaben
- **Faire Aufteilung:** Ausgaben können gleichmäßig oder individuell (Custom Split) aufgeteilt werden.
- **Schulden-Übersicht:** Wer schuldet wem wie viel? Die App berechnet automatisch die Bilanz.
- **PayPal Integration:** Schulden können direkt per PayPal.me Link beglichen werden.
- **Verwaltung:** Eigene Ausgaben können nachträglich bearbeitet oder gelöscht werden.

### 🔒 Accounts & Sicherheit
- **Erster Login:** Der Admin legt Bewohner mit einem Startpasswort an (z.B. `123`). Beim ersten Login muss jeder ein eigenes Passwort (mind. 8 Zeichen) festlegen und kann danach freiwillig Profilbild, PayPal und Telefon eintragen.
- **Passwort vergessen:** Der Admin setzt ein vorläufiges Passwort, beim nächsten Login wird wieder ein eigenes verlangt.
- **Admin-Bereich:** Bewohner anlegen, ersetzen (übernimmt den Platz im Putzplan), löschen, Passwörter zurücksetzen.
- **Schutz:** Passwörter gehasht (scrypt), Sperre nach 10 Fehlversuchen, serverseitige Prüfung aller Eingaben, Content-Security-Policy.

## 🛠 Technologie-Stack

- **Frontend:** Vanilla JavaScript, HTML5, Modern CSS – Ordner `frontend/`
- **PWA:** Installierbar auf iPhone & Android (Home-Bildschirm, Vollbild, eigenes Icon)
- **Backend:** Node.js, Express Framework – Ordner `backend/`
- **Datenbank:** JSON-basierte Persistenz (`backend/database.json`)
- **Design:** Apple-inspiriertes Interface mit Dark Mode Support

## 📁 Projektstruktur

```
Die_Palast_App/
├── frontend/                  # Website (wird vom Backend bzw. Nginx ausgeliefert)
│   ├── index.html, app.js, style.css, data.js
│   ├── manifest.webmanifest   # App-Name, Icon, Farben für den Home-Bildschirm
│   ├── sw.js                  # Service Worker (Offline-Fallback)
│   ├── icons/
│   └── vendor/                # HEIC-Decoder (nur für iPhone-Fotos nachgeladen)
├── deploy/palast-deploy.sh    # Deploy-Skript für den Server (siehe "Automatisches Deployment")
├── .github/workflows/         # GitHub Actions: prüfen + deployen bei jedem Push auf main
└── backend/
    ├── server.js              # Express-API (/api/...) + liefert frontend/ aus
    ├── db.js                  # Datenbank-Datei lesen/schreiben, Migration
    ├── passwords.js           # Passwort-Hashing
    ├── database.json          # Live-Daten – NICHT im Repo, wird beim ersten Start angelegt
    └── scripts/               # Hilfsskripte (Notfall-Reset, Python, Excel)
```

## 📦 Installation & Setup

1. **Repository klonen:**
   ```bash
   git clone https://github.com/LeonAdolphUni/Die_Palast_App.git
   cd Die_Palast_App
   ```

2. **Server starten:**
   ```bash
   cd backend
   npm install
   npm start
   ```
   Die App läuft dann auf `http://localhost:3000`. Beim ersten Start wird `database.json` mit den
   Bewohnern aus `backend/db.js` angelegt – Startpasswort für alle (auch `Admin`): `123`.

### Admin-Passwort vergessen?
Direkt auf dem Server (danach den Server neu starten):
```bash
cd backend
node scripts/reset-password.js Admin 123
```

## 📱 Auf dem Handy installieren

- **iPhone (Safari):** Teilen-Button → „Zum Home-Bildschirm“
- **Android (Chrome):** Menü ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“

Die App öffnet sich dann im Vollbild ohne Browserleiste. **Voraussetzung:** Die Seite läuft über HTTPS
(siehe unten) – ohne HTTPS funktionieren Service Worker und die Installation unter Android nicht.

## 🌐 Deployment (Linux Server)

Auf dem Server muss dieselbe Ordnerstruktur liegen (`frontend/` neben `backend/`).
`database.json` ist nicht im Repo – die Live-Datei auf dem Server bleibt einfach liegen.
Vor jedem Update trotzdem ein Backup davon machen.

Beim ersten Start mit dieser Version werden alte Klartext-Passwörter automatisch gehasht,
danach muss jeder (auch Admin) beim nächsten Login ein neues Passwort festlegen.

```bash
scp -r frontend leon@derpalast.net:/var/www/derpalast/webserver/
scp backend/*.js backend/package.json backend/package-lock.json leon@derpalast.net:/var/www/derpalast/webserver/backend/
scp -r backend/scripts leon@derpalast.net:/var/www/derpalast/webserver/backend/
```

Hinter Nginx den Node-Server nur lokal lauschen lassen, damit Port 3000 nicht von außen erreichbar ist:
```bash
HOST=127.0.0.1 npm start
```

### Automatisches Deployment (GitHub Actions)

Jeder Push auf `main` startet `.github/workflows/deploy.yml`: Erst wird der Code geprüft (Syntax,
Server startet testweise), dann verbindet sich GitHub per SSH mit dem Server und ruft
`/usr/local/bin/palast-deploy` mit der Commit-ID auf. Das Skript holt genau diesen Commit, sichert
die Datenbank, kopiert `frontend/` und `backend/` in den Docker-Ordner, baut den Container neu und
prüft `/api/flatmates`. Startet der neue Stand nicht, spielt es den alten zurück.
Manuell auslösen: GitHub → Actions → Deploy → „Run workflow“.

Der SSH-Schlüssel darf auf dem Server **nur** dieses Skript starten (`restrict,command=...` in
`authorized_keys`) – mehr kann man mit ihm nicht anstellen.

**Einmalige Einrichtung auf dem Server**
1. Repo nach `/opt/palast-src` klonen (das Docker-Setup bleibt in `/opt/palast-app`).
2. `install -o root -g root -m 755 /opt/palast-src/deploy/palast-deploy.sh /usr/local/bin/palast-deploy`
3. Benutzer `deploy` anlegen (Gruppe `docker`, Schreibrechte auf `/opt/palast-src`,
   `/opt/palast-app/frontend`, `/opt/palast-app/backend`, `/opt/palast-app/data/backups`).
4. In `~deploy/.ssh/authorized_keys`:
   `restrict,command="/usr/local/bin/palast-deploy" ssh-ed25519 AAAA... github-actions-palast-deploy`

**Secrets in GitHub** (Settings → Environments → `production`):

| Secret | Inhalt |
| --- | --- |
| `DEPLOY_HOST` | z. B. `derpalast.net` |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_PORT` | SSH-Port (optional, Standard 22) |
| `DEPLOY_SSH_KEY` | privater Schlüssel (kompletter Inhalt der Datei) |
| `DEPLOY_KNOWN_HOSTS` | Ausgabe von `ssh-keyscan -p <port> <host>` |

Solange die Secrets fehlen, wird nur geprüft und das Deployment mit einer Warnung übersprungen.

### Nginx Reverse Proxy (Empfohlen)
Um die App über Port 80/443 (HTTP/HTTPS) ohne `:3000` zu betreiben, nutze diese Nginx-Config:

```nginx
server {
    listen 80;
    server_name derpalast.net;

    server_tokens off;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy no-referrer always;

    location / {
        root /var/www/derpalast/webserver/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### HTTPS (für die PWA nötig)
Kostenloses Zertifikat mit Let's Encrypt – Certbot ergänzt die Nginx-Config automatisch:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d derpalast.net
```

## 📝 Lizenz

Dieses Projekt ist für die private Nutzung in Wohngemeinschaften gedacht.
