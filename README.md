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

- **Frontend:** Vanilla JavaScript, HTML5, Modern CSS (Glassmorphism, CSS Variables)
- **Backend:** Node.js, Express Framework
- **Datenbank:** JSON-basierte Persistenz (`database.json`)
- **Design:** Apple-inspiriertes Interface mit Dark Mode Support

## 📦 Installation & Setup

1. **Repository klonen:**
   ```bash
   git clone https://github.com/LeonAdolphUni/Die_Palast_App.git
   cd Die_Palast_App
   ```

2. **Abhängigkeiten installieren:**
   ```bash
   npm install
   ```

3. **Server starten:**
   ```bash
   npm start
   ```
   Die App läuft standardmäßig auf `http://derpalast.net:3000`.

## 🌐 Deployment (Linux Server)

Falls du die App auf einem eigenen Server hostest, schiebe alle Dateien in den Web-Ordner:

```bash
scp index.html app.js style.css server.js package.json database.json data.js leon@derpalast.net:/var/www/derpalast/webserver/
```

### Nginx Reverse Proxy (Empfohlen)
Um die App über Port 80/443 (HTTP/HTTPS) ohne `:3000` zu betreiben, nutze diese Nginx-Config:

```nginx
server {
    listen 80;
    server_name derpalast.net;

    location / {
        root /var/www/derpalast/webserver;
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

## 📝 Lizenz

Dieses Projekt ist für die private Nutzung in Wohngemeinschaften gedacht.
