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

### 🔒 Sicherheit & Profile
- **Persönliche Accounts:** Jeder Mitbewohner hat einen eigenen Zugang mit Passwort.
- **Admin-Bereich:** Dedizierter Bereich für WG-weite Einstellungen.
- **Profil-Management:** Hinterlege deinen PayPal Namen für einfache Zahlungen.

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
│   └── icons/
└── backend/
    ├── server.js              # Express-API (/api/...) + liefert frontend/ aus
    ├── database.json
    └── scripts/               # Hilfsskripte (Python, Excel)
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
   Die App läuft dann auf `http://localhost:3000`.

## 📱 Auf dem Handy installieren

- **iPhone (Safari):** Teilen-Button → „Zum Home-Bildschirm“
- **Android (Chrome):** Menü ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“

Die App öffnet sich dann im Vollbild ohne Browserleiste. **Voraussetzung:** Die Seite läuft über HTTPS
(siehe unten) – ohne HTTPS funktionieren Service Worker und die Installation unter Android nicht.

## 🌐 Deployment (Linux Server)

Auf dem Server muss dieselbe Ordnerstruktur liegen (`frontend/` neben `backend/`).
`database.json` nur beim ersten Mal hochladen, sonst überschreibst du die Live-Daten:

```bash
scp -r frontend leon@derpalast.net:/var/www/derpalast/webserver/
scp backend/server.js backend/package.json leon@derpalast.net:/var/www/derpalast/webserver/backend/
```

### Nginx Reverse Proxy (Empfohlen)
Um die App über Port 80/443 (HTTP/HTTPS) ohne `:3000` zu betreiben, nutze diese Nginx-Config:

```nginx
server {
    listen 80;
    server_name derpalast.net;

    location / {
        root /var/www/derpalast/webserver/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
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
