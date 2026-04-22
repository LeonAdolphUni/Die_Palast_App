import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

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

// --- API ROUTES ---

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    if (db.users[username] && db.users[username].password === password) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Falsches Passwort' });
    }
});

// Tasks
app.get('/api/tasks/:weekKey', (req, res) => {
    const { weekKey } = req.params;
    const db = readDB();
    res.json({ success: true, data: db.tasksCompleted[weekKey] || {} });
});

app.post('/api/tasks/:weekKey', (req, res) => {
    const { weekKey } = req.params;
    const { username, completed } = req.body;
    const db = readDB();
    if (!db.tasksCompleted[weekKey]) db.tasksCompleted[weekKey] = {};
    db.tasksCompleted[weekKey][username] = completed;
    writeDB(db);
    res.json({ success: true });
});

// Shopping
app.get('/api/shopping', (req, res) => {
    const db = readDB();
    res.json({ success: true, data: db.shoppingList || [] });
});

app.post('/api/shopping', (req, res) => {
    const { text } = req.body;
    const db = readDB();
    const newItem = { id: Date.now().toString(), text };
    if (!db.shoppingList) db.shoppingList = [];
    db.shoppingList.push(newItem);
    writeDB(db);
    res.json({ success: true, data: newItem });
});

app.delete('/api/shopping/:id', (req, res) => {
    const db = readDB();
    db.shoppingList = db.shoppingList.filter(i => i.id !== req.params.id);
    writeDB(db);
    res.json({ success: true });
});

// Users Public
app.get('/api/users/public', (req, res) => {
    const db = readDB();
    const publicUsers = {};
    for (const [name, data] of Object.entries(db.users)) {
        publicUsers[name] = { paypal: data.paypal || '' };
    }
    res.json({ success: true, data: publicUsers });
});

app.put('/api/users/:username/paypal', (req, res) => {
    const { username } = req.params;
    const { paypal } = req.body;
    const db = readDB();
    if (db.users[username]) {
        db.users[username].paypal = paypal;
        writeDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false });
    }
});

// Expenses
app.get('/api/expenses', (req, res) => {
    const db = readDB();
    res.json({ success: true, data: db.expenses || [] });
});

app.post('/api/expenses', (req, res) => {
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

app.put('/api/expenses/:id', (req, res) => {
    const { id } = req.params;
    const { description, amount, paidBy, splits } = req.body;
    const db = readDB();
    const idx = db.expenses.findIndex(e => e.id === id);
    if (idx !== -1) {
        db.expenses[idx] = { ...db.expenses[idx], description, amount, paidBy, splits };
        writeDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false });
    }
});

app.delete('/api/expenses/:id', (req, res) => {
    const db = readDB();
    db.expenses = db.expenses.filter(e => e.id !== req.params.id);
    writeDB(db);
    res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 WG Putzplan Server läuft auf http://localhost:${PORT}`);
});
