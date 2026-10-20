import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { ADMIN, readDB, writeDB, hasUser, createUser, paypalHandle, initDB } from './db.js';
import { hashPassword, verifyPassword } from './passwords.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 3000;
// Hinter Nginx HOST=127.0.0.1 setzen, damit Port 3000 nicht direkt aus dem Internet erreichbar ist
const HOST = process.env.HOST || '0.0.0.0';
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

const SESSION_TTL = 4 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;
const MAX_LOGIN_ATTEMPTS = 10;
const LOCK_TIME = 15 * 60 * 1000;

// Buchstabe am Anfang, danach Buchstaben, Ziffern, Leerzeichen, . _ - (max. 30 Zeichen)
const NAME_PATTERN = /^\p{L}[\p{L}\p{N} ._-]{0,29}$/u;
const PHONE_PATTERN = /^[+0-9 ()/-]{0,30}$/;
const IMAGE_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
const MAX_IMAGE_LENGTH = 200_000;
const WEEK_KEY_PATTERN = /^\d{4}-W-?\d{1,4}$/;
const MAX_TEXT_LENGTH = 100;

await initDB();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '300kb' }));

app.use((req, res, next) => {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "frame-ancestors 'none'",
    });
    if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
    next();
});

app.use(express.static(FRONTEND_DIR));

// --- Hilfsfunktionen ---

// Reihenfolge in db.users = Reihenfolge der Putzplan-Rotation
const flatmatesOf = (db) => Object.keys(db.users).filter(name => name !== ADMIN);

const userInfo = (name, user) => ({
    name,
    isAdmin: name === ADMIN,
    mustChangePassword: !!user.mustChangePassword,
    onboarded: !!user.onboarded,
});

const fail = (res, status, message, extra = {}) => res.status(status).json({ success: false, message, ...extra });

// Express 4 fängt Fehler aus async-Handlern nicht selbst ab
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const cleanText = (value) => typeof value === 'string' ? value.trim() : '';

function checkNewPassword(password) {
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
        return `Das Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen`;
    }
    if (password.length > 200) return 'Das Passwort ist zu lang';
    return null;
}

// Aktuelle Bewohner + ehemalige aus alten Ausgaben (damit deren Schulden beglichen werden können)
function knownNames(db) {
    const names = new Set(flatmatesOf(db));
    for (const e of db.expenses) {
        names.add(e.paidBy);
        Object.keys(e.splits || {}).forEach(n => names.add(n));
    }
    return names;
}

function parseExpense(body, db) {
    const description = cleanText(body.description);
    const amount = Number(body.amount);
    const names = knownNames(db);
    if (!description || description.length > MAX_TEXT_LENGTH) return { error: 'Ungültige Beschreibung' };
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) return { error: 'Ungültiger Betrag' };
    if (!names.has(body.paidBy)) return { error: 'Ungültiger Zahler' };
    if (!body.splits || typeof body.splits !== 'object' || Array.isArray(body.splits)) return { error: 'Ungültige Aufteilung' };

    const splits = {};
    let total = 0;
    for (const [name, share] of Object.entries(body.splits)) {
        const value = Number(share);
        if (!names.has(name) || !Number.isFinite(value) || value < 0) return { error: 'Ungültige Aufteilung' };
        splits[name] = value;
        total += value;
    }
    if (Math.abs(total - amount) > 0.05) return { error: 'Summe der Anteile stimmt nicht mit dem Betrag überein' };
    return { expense: { description, amount, paidBy: body.paidBy, splits } };
}

// --- Sessions & Login-Schutz ---

// token -> { username, createdAt }. Liegt im Speicher: nach einem Neustart muss man sich neu anmelden
const sessions = new Map();

const endSessionsOf = (username, exceptToken = null) => {
    for (const [token, s] of sessions) {
        if (s.username === username && token !== exceptToken) sessions.delete(token);
    }
};

setInterval(() => {
    const now = Date.now();
    for (const [token, s] of sessions) if (now - s.createdAt > SESSION_TTL) sessions.delete(token);
}, 60 * 60 * 1000).unref();

// Gegen Passwort-Raten: nach 10 Fehlversuchen ist der Account 15 Minuten gesperrt
const failedLogins = new Map(); // username -> { count, since }

function lockRemaining(username) {
    const f = failedLogins.get(username);
    if (!f) return 0;
    if (Date.now() - f.since > LOCK_TIME) { failedLogins.delete(username); return 0; }
    return f.count >= MAX_LOGIN_ATTEMPTS ? f.since + LOCK_TIME - Date.now() : 0;
}

function registerFailedLogin(username) {
    const f = failedLogins.get(username);
    if (!f || Date.now() - f.since > LOCK_TIME) failedLogins.set(username, { count: 1, since: Date.now() });
    else f.count++;
}

const authenticate = (req, res, next) => {
    const token = req.get('Authorization');
    const session = token ? sessions.get(token) : null;
    if (!session) return fail(res, 401, 'Nicht angemeldet');
    if (Date.now() - session.createdAt > SESSION_TTL) {
        sessions.delete(token);
        return fail(res, 401, 'Sitzung abgelaufen');
    }
    const db = readDB();
    if (!hasUser(db, session.username)) {
        sessions.delete(token);
        return fail(res, 401, 'Account existiert nicht mehr');
    }
    req.username = session.username;
    req.user = db.users[session.username];
    req.token = token;
    next();
};

// Solange das Startpasswort nicht geändert ist, sind nur Login-, Logout- und /api/me-Routen erlaubt
const passwordChanged = (req, res, next) => {
    if (req.user.mustChangePassword) {
        return fail(res, 403, 'Bitte zuerst ein neues Passwort festlegen', { code: 'PASSWORD_CHANGE_REQUIRED' });
    }
    next();
};

const auth = [authenticate, passwordChanged];

const requireAdmin = (req, res, next) => {
    if (req.username !== ADMIN) return fail(res, 403, 'Nur für Admin');
    next();
};

// --- Login & eigener Account ---

app.post('/api/login', asyncRoute(async (req, res) => {
    const { username, password } = req.body;
    if (typeof username !== 'string' || typeof password !== 'string') return fail(res, 400, 'Name und Passwort fehlen');

    const db = readDB();
    if (!hasUser(db, username)) return fail(res, 401, 'Falsches Passwort');

    const wait = lockRemaining(username);
    if (wait) return fail(res, 429, `Zu viele Fehlversuche. Bitte in ${Math.ceil(wait / 60000)} Minuten erneut versuchen.`);

    if (!await verifyPassword(password, db.users[username].passwordHash)) {
        registerFailedLogin(username);
        return fail(res, 401, 'Falsches Passwort');
    }

    failedLogins.delete(username);
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { username, createdAt: Date.now() });
    res.json({ success: true, token, user: userInfo(username, db.users[username]) });
}));

app.post('/api/logout', authenticate, (req, res) => {
    sessions.delete(req.token);
    res.json({ success: true });
});

app.get('/api/me', authenticate, (req, res) => {
    res.json({ success: true, data: userInfo(req.username, req.user) });
});

// Beim ersten Login (oder nach Admin-Reset) ohne altes Passwort, sonst muss das aktuelle mitgeschickt werden
app.put('/api/me/password', authenticate, asyncRoute(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const problem = checkNewPassword(newPassword);
    if (problem) return fail(res, 400, problem);

    if (!req.user.mustChangePassword) {
        if (typeof currentPassword !== 'string' || !await verifyPassword(currentPassword, req.user.passwordHash)) {
            return fail(res, 403, 'Aktuelles Passwort ist falsch');
        }
    }
    if (await verifyPassword(newPassword, req.user.passwordHash)) {
        return fail(res, 400, 'Bitte ein anderes Passwort als das bisherige wählen');
    }

    const passwordHash = await hashPassword(newPassword);
    const db = readDB();
    if (!hasUser(db, req.username)) return fail(res, 404, 'Account existiert nicht mehr');
    db.users[req.username].passwordHash = passwordHash;
    db.users[req.username].mustChangePassword = false;
    writeDB(db);
    // Andere Geräte abmelden, das aktuelle bleibt angemeldet
    endSessionsOf(req.username, req.token);
    res.json({ success: true, data: userInfo(req.username, db.users[req.username]) });
}));

// Speichert Profilbild/PayPal/Telefon und markiert die Ersteinrichtung als erledigt (auch bei leerem Body)
app.put('/api/me/profile', auth, (req, res) => {
    const { paypal, phone, profilePic } = req.body;
    const update = {};

    if (paypal !== undefined) {
        const handle = paypalHandle(paypal);
        if (handle === null) return fail(res, 400, 'Ungültiger PayPal.me-Name');
        update.paypal = handle;
    }
    if (phone !== undefined) {
        if (typeof phone !== 'string' || !PHONE_PATTERN.test(phone.trim())) return fail(res, 400, 'Ungültige Telefonnummer');
        update.phone = phone.trim();
    }
    if (profilePic !== undefined) {
        const valid = profilePic === '' || (typeof profilePic === 'string' && profilePic.length <= MAX_IMAGE_LENGTH && IMAGE_PATTERN.test(profilePic));
        if (!valid) return fail(res, 400, 'Ungültiges oder zu großes Profilbild');
        update.profilePic = profilePic;
    }

    const db = readDB();
    Object.assign(db.users[req.username], update, { onboarded: true });
    writeDB(db);
    res.json({ success: true });
});

// --- Bewohner ---

// Öffentlich: Namen für die Login-Auswahl (ohne weitere Daten)
app.get('/api/flatmates', (req, res) => {
    res.json({ success: true, data: flatmatesOf(readDB()) });
});

app.get('/api/users/public', auth, (req, res) => {
    const db = readDB();
    const publicUsers = {};
    for (const [name, data] of Object.entries(db.users)) {
        publicUsers[name] = { paypal: data.paypal || '', phone: data.phone || '', profilePic: data.profilePic || '' };
    }
    res.json({ success: true, data: publicUsers });
});

// Admin-Übersicht inkl. Status, ob das Startpasswort noch geändert werden muss
app.get('/api/users', auth, requireAdmin, (req, res) => {
    const db = readDB();
    res.json({
        success: true,
        data: flatmatesOf(db).map(name => ({ name, mustChangePassword: !!db.users[name].mustChangePassword })),
    });
});

// Bewohner anlegen – mit "replaces" ersetzt er einen bestehenden und übernimmt dessen Platz im Putzplan.
// Alte Ausgaben/Schulden bleiben unter dem alten Namen bestehen.
app.post('/api/users', auth, requireAdmin, asyncRoute(async (req, res) => {
    const username = cleanText(req.body.username);
    const { password, replaces } = req.body;

    if (!NAME_PATTERN.test(username)) return fail(res, 400, 'Ungültiger Name (nur Buchstaben, Zahlen, Leerzeichen, . _ -)');
    if (typeof password !== 'string' || !password.trim() || password.length > 200) return fail(res, 400, 'Bitte ein Startpasswort eingeben');

    const newUser = await createUser(password);
    const db = readDB();
    const taken = Object.keys(db.users).some(n => n !== replaces && n.toLowerCase() === username.toLowerCase());
    if (taken) return fail(res, 409, 'Name ist schon vergeben');

    if (replaces !== undefined) {
        if (replaces === ADMIN || !hasUser(db, replaces)) return fail(res, 404, 'Bewohner nicht gefunden');
        // Neu aufbauen, damit die Reihenfolge (= Rotation) erhalten bleibt
        db.users = Object.fromEntries(Object.entries(db.users).map(
            ([name, data]) => name === replaces ? [username, newUser] : [name, data]
        ));
        endSessionsOf(replaces);
    } else {
        db.users[username] = newUser;
    }
    writeDB(db);
    res.json({ success: true, data: flatmatesOf(db) });
}));

// Passwort vergessen: Admin vergibt ein vorläufiges Passwort, beim nächsten Login muss ein neues gesetzt werden
app.post('/api/users/:username/reset-password', auth, requireAdmin, asyncRoute(async (req, res) => {
    const { username } = req.params;
    const { password } = req.body;
    if (typeof password !== 'string' || !password.trim() || password.length > 200) return fail(res, 400, 'Bitte ein vorläufiges Passwort eingeben');

    const passwordHash = await hashPassword(password);
    const db = readDB();
    if (username === ADMIN || !hasUser(db, username)) return fail(res, 404, 'Bewohner nicht gefunden');
    db.users[username].passwordHash = passwordHash;
    db.users[username].mustChangePassword = true;
    writeDB(db);
    endSessionsOf(username);
    failedLogins.delete(username);
    res.json({ success: true });
}));

app.delete('/api/users/:username', auth, requireAdmin, (req, res) => {
    const { username } = req.params;
    const db = readDB();
    if (username === ADMIN || !hasUser(db, username)) return fail(res, 404, 'Bewohner nicht gefunden');
    if (flatmatesOf(db).length <= 1) return fail(res, 400, 'Der letzte Bewohner kann nicht gelöscht werden');
    delete db.users[username];
    writeDB(db);
    endSessionsOf(username);
    res.json({ success: true, data: flatmatesOf(db) });
});

// --- Putzplan ---

app.get('/api/tasks/:weekKey', auth, (req, res) => {
    const { weekKey } = req.params;
    if (!WEEK_KEY_PATTERN.test(weekKey)) return fail(res, 400, 'Ungültige Woche');
    const db = readDB();
    res.json({ success: true, data: Object.hasOwn(db.tasksCompleted, weekKey) ? db.tasksCompleted[weekKey] : {} });
});

// Jeder kann nur seine eigene Aufgabe abhaken
app.post('/api/tasks/:weekKey', auth, (req, res) => {
    const { weekKey } = req.params;
    const { completed } = req.body;
    if (!WEEK_KEY_PATTERN.test(weekKey)) return fail(res, 400, 'Ungültige Woche');
    if (typeof completed !== 'boolean') return fail(res, 400, 'Ungültiger Status');
    if (req.username === ADMIN) return fail(res, 403, 'Admin hat keine Putzaufgaben');

    const db = readDB();
    if (!Object.hasOwn(db.tasksCompleted, weekKey)) db.tasksCompleted[weekKey] = {};
    db.tasksCompleted[weekKey][req.username] = completed;
    writeDB(db);
    res.json({ success: true });
});

// --- Einkaufsliste ---

app.get('/api/shopping', auth, (req, res) => {
    res.json({ success: true, data: readDB().shoppingList });
});

app.post('/api/shopping', auth, (req, res) => {
    const text = cleanText(req.body.text);
    if (!text || text.length > MAX_TEXT_LENGTH) return fail(res, 400, 'Ungültiger Eintrag');
    const db = readDB();
    const newItem = { id: crypto.randomUUID(), text };
    db.shoppingList.push(newItem);
    writeDB(db);
    res.json({ success: true, data: newItem });
});

app.delete('/api/shopping/:id', auth, (req, res) => {
    const db = readDB();
    db.shoppingList = db.shoppingList.filter(i => i.id !== req.params.id);
    writeDB(db);
    res.json({ success: true });
});

// --- Finanzen ---

app.get('/api/expenses', auth, (req, res) => {
    res.json({ success: true, data: readDB().expenses });
});

app.post('/api/expenses', auth, (req, res) => {
    const db = readDB();
    const { expense, error } = parseExpense(req.body, db);
    if (error) return fail(res, 400, error);
    const newExp = { id: crypto.randomUUID(), ...expense, addedBy: req.username, date: new Date().toISOString() };
    db.expenses.push(newExp);
    writeDB(db);
    res.json({ success: true, data: newExp });
});

// Bearbeiten/Löschen darf nur, wer die Ausgabe angelegt hat (oder Admin).
// Alte Ausgaben ohne "addedBy" darf derjenige ändern, der bezahlt hat.
const canEditExpense = (exp, username) =>
    username === ADMIN || (exp.addedBy ? exp.addedBy === username : exp.paidBy === username);

app.put('/api/expenses/:id', auth, (req, res) => {
    const db = readDB();
    const idx = db.expenses.findIndex(e => e.id === req.params.id);
    if (idx === -1) return fail(res, 404, 'Ausgabe nicht gefunden');
    if (!canEditExpense(db.expenses[idx], req.username)) return fail(res, 403, 'Keine Berechtigung');
    const { expense, error } = parseExpense(req.body, db);
    if (error) return fail(res, 400, error);
    db.expenses[idx] = { ...db.expenses[idx], ...expense };
    writeDB(db);
    res.json({ success: true });
});

app.delete('/api/expenses/:id', auth, (req, res) => {
    const db = readDB();
    const idx = db.expenses.findIndex(e => e.id === req.params.id);
    if (idx === -1) return fail(res, 404, 'Ausgabe nicht gefunden');
    if (!canEditExpense(db.expenses[idx], req.username)) return fail(res, 403, 'Keine Berechtigung');
    db.expenses.splice(idx, 1);
    writeDB(db);
    res.json({ success: true });
});

// --- Fehlerbehandlung (nie Stacktraces an den Browser schicken) ---

app.use('/api', (req, res) => fail(res, 404, 'Unbekannter Endpunkt'));

app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return fail(res, 413, 'Daten zu groß');
    if (err.type === 'entity.parse.failed') return fail(res, 400, 'Ungültige Anfrage');
    console.error(err);
    fail(res, 500, 'Serverfehler');
});

app.listen(PORT, HOST, () => {
    console.log(`Palast-Server läuft auf http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});
