import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hashPassword } from './passwords.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'database.json');
export const ADMIN = 'Admin';
export const INITIAL_PASSWORD = '123';
const INITIAL_USERS = ['Leon', 'Andi', 'Junior', 'Paul', 'Timo', ADMIN];

export const readDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));

// Erst in eine temporäre Datei schreiben, dann umbenennen – so ist die DB nie halb geschrieben
export const writeDB = (data) => {
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, DB_FILE);
};

// hasOwn statt db.users[name], sonst gelten Namen wie "constructor" als vorhanden
export const hasUser = (db, name) => typeof name === 'string' && Object.hasOwn(db.users, name);

// Neuer Account: muss beim ersten Login ein eigenes Passwort setzen und sieht die Einrichtung
export const createUser = async (password) => ({
    passwordHash: await hashPassword(password),
    mustChangePassword: true,
    onboarded: false,
});

// "https://paypal.me/Name", "paypal.me/Name" oder "Name" -> "Name"; null wenn ungültig
export function paypalHandle(input) {
    const handle = String(input).trim()
        .replace(/^(https?:\/\/)?(www\.)?paypal\.me\//i, '')
        .replace(/\/+$/, '');
    if (handle === '') return '';
    return /^[A-Za-z0-9._-]{1,50}$/.test(handle) ? handle : null;
}

// Legt die DB beim ersten Start an und bringt alte Datenstände auf das aktuelle Format
export async function initDB() {
    if (!fs.existsSync(DB_FILE)) {
        const users = {};
        for (const name of INITIAL_USERS) users[name] = await createUser(INITIAL_PASSWORD);
        writeDB({ users, tasksCompleted: {}, shoppingList: [], expenses: [] });
        console.log(`Neue Datenbank angelegt. Startpasswort für alle: ${INITIAL_PASSWORD}`);
        return;
    }

    const db = readDB();
    let changed = false;
    for (const user of Object.values(db.users)) {
        // Klartext-Passwörter aus alten Versionen: hashen und beim nächsten Login ein neues verlangen
        if (typeof user.password === 'string') {
            user.passwordHash = await hashPassword(user.password);
            delete user.password;
            user.mustChangePassword = true;
            user.onboarded = false;
            changed = true;
        }
        if (user.paypal) {
            const handle = paypalHandle(user.paypal) ?? '';
            if (handle !== user.paypal) { user.paypal = handle; changed = true; }
        }
    }
    for (const key of ['shoppingList', 'expenses']) {
        if (!Array.isArray(db[key])) { db[key] = []; changed = true; }
    }
    if (!db.tasksCompleted || typeof db.tasksCompleted !== 'object') { db.tasksCompleted = {}; changed = true; }
    if (changed) {
        writeDB(db);
        console.log('Datenbank auf das neue Format aktualisiert (Passwörter gehasht).');
    }
}
