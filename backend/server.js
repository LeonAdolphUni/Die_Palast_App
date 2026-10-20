import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Initialize Database
const initDB = () => {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            users: {
                "Leon": { password: "123" },
                "Andi": { password: "123" },
                "Felix": { password: "123" },
                "Paul": { password: "123" },
                "Timo": { password: "123" }
            },
            tasksCompleted: {},
            shoppingList: [],
            expenses: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    }
};

initDB();

const readDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// Simple Session Store (in-memory for now, clears on server restart)
const sessions = new Map();

// Middleware: Authentifizierung prüfen
const authenticate = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ success: false, message: 'Nicht autorisiert' });

    let foundUser = null;
    for (const [username, session] of sessions.entries()) {
        if (session.token === token) {
            // Prüfung auf Timeout (z.B. 4 Stunden)
            if (Date.now() - session.createdAt > 4 * 60 * 60 * 1000) {
                sessions.delete(username);
                return res.status(401).json({ success: false, message: 'Sitzung abgelaufen' });
            }
            foundUser = username;
            break;
        }
    }

    if (foundUser) {
        req.username = foundUser;
        next();
    } else {
        res.status(401).json({ success: false, message: 'Ungültiges Token' });
    }
};

// --- API ROUTES ---

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    if (db.users[username] && db.users[username].password === password) {
        const token = crypto.randomBytes(32).toString('hex');
        sessions.set(username, { token, createdAt: Date.now() });
        res.json({ success: true, token });
    } else {
        res.status(401).json({ success: false, message: 'Falsches Passwort' });
    }
});

// Alle anderen Routen schützen
app.get('/api/tasks/:weekKey', authenticate, (req, res) => {
    const { weekKey } = req.params;
    const db = readDB();
    res.json({ success: true, data: db.tasksCompleted[weekKey] || {} });
});

app.post('/api/tasks/:weekKey', authenticate, (req, res) => {
    const { weekKey } = req.params;
    const { username, completed } = req.body;
    const db = readDB();
    if (!db.tasksCompleted[weekKey]) db.tasksCompleted[weekKey] = {};
    db.tasksCompleted[weekKey][username] = completed;
    writeDB(db);
    res.json({ success: true });
});

app.get('/api/shopping', authenticate, (req, res) => {
    const db = readDB();
    res.json({ success: true, data: db.shoppingList || [] });
});

app.post('/api/shopping', authenticate, (req, res) => {
    const { text } = req.body;
    const db = readDB();
    const newItem = { id: Date.now().toString(), text };
    if (!db.shoppingList) db.shoppingList = [];
    db.shoppingList.push(newItem);
    writeDB(db);
    res.json({ success: true, data: newItem });
});

app.delete('/api/shopping/:id', authenticate, (req, res) => {
    const db = readDB();
    db.shoppingList = db.shoppingList.filter(i => i.id !== req.params.id);
    writeDB(db);
    res.json({ success: true });
});

app.get('/api/users/public', authenticate, (req, res) => {
    const db = readDB();
    const publicUsers = {};
    for (const [name, data] of Object.entries(db.users)) {
        publicUsers[name] = { 
            paypal: data.paypal || '',
            phone: data.phone || '',
            profilePic: data.profilePic || ''
        };
    }
    res.json({ success: true, data: publicUsers });
});

app.put('/api/users/:username/profile', authenticate, (req, res) => {
    const { username } = req.params;
    const { paypal, phone, profilePic } = req.body;
    
    // Security: Man darf nur sein EIGENES Profil ändern (außer Admin)
    if (req.username !== username && req.username !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Verboten' });
    }

    const db = readDB();
    if (db.users[username]) {
        if (paypal !== undefined) db.users[username].paypal = paypal;
        if (phone !== undefined) db.users[username].phone = phone;
        if (profilePic !== undefined) db.users[username].profilePic = profilePic;
        writeDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false });
    }
});

app.put('/api/users/:username/password', authenticate, (req, res) => {
    const { username } = req.params;
    const { newPassword } = req.body;
    
    // Security: Nur Admin darf Passwörter anderer ändern
    if (req.username !== 'Admin') {
        return res.status(403).json({ success: false });
    }

    const db = readDB();
    if (db.users[username]) {
        db.users[username].password = newPassword;
        writeDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false });
    }
});

app.get('/api/expenses', authenticate, (req, res) => {
    const db = readDB();
    res.json({ success: true, data: db.expenses || [] });
});

app.post('/api/expenses', authenticate, (req, res) => {
    const { description, amount, paidBy, splits, addedBy } = req.body;
    const db = readDB();
    const newExp = {
        id: Date.now().toString(),
        description,
        amount,
        paidBy,
        splits,
        addedBy,
        date: new Date().toISOString()
    };
    if (!db.expenses) db.expenses = [];
    db.expenses.push(newExp);
    writeDB(db);
    res.json({ success: true, data: newExp });
});

app.put('/api/expenses/:id', authenticate, (req, res) => {
    const { id } = req.params;
    const { description, amount, paidBy, splits } = req.body;
    const db = readDB();
    const idx = db.expenses.findIndex(e => e.id === id);
    if (idx !== -1) {
        // Security: Check ownership
        if (db.expenses[idx].addedBy !== req.username && req.username !== 'Admin') {
            return res.status(403).json({ success: false });
        }
        db.expenses[idx] = { ...db.expenses[idx], description, amount, paidBy, splits };
        writeDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false });
    }
});

app.delete('/api/expenses/:id', authenticate, (req, res) => {
    const db = readDB();
    const idx = db.expenses.findIndex(e => e.id === req.params.id);
    if (idx !== -1) {
        // Security: Check ownership
        if (db.expenses[idx].addedBy !== req.username && req.username !== 'Admin') {
            return res.status(403).json({ success: false });
        }
        db.expenses.splice(idx, 1);
        writeDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 WG Putzplan Server läuft auf http://localhost:${PORT}`);
});
