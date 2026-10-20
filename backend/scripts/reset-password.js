// Notfall-Reset direkt auf dem Server, z.B. wenn der Admin sein Passwort vergessen hat:
//   node scripts/reset-password.js Admin 123
// Danach muss beim nächsten Login ein neues Passwort gesetzt werden.
// Danach den Server neu starten, damit alte Sitzungen ungültig werden.
import { readDB, writeDB, hasUser } from '../db.js';
import { hashPassword } from '../passwords.js';

const [username, password] = process.argv.slice(2);
if (!username || !password) {
    console.error('Aufruf: node scripts/reset-password.js <Name> <vorläufiges Passwort>');
    process.exit(1);
}

const db = readDB();
if (!hasUser(db, username)) {
    console.error(`Unbekannter Nutzer: ${username}. Vorhanden: ${Object.keys(db.users).join(', ')}`);
    process.exit(1);
}

db.users[username].passwordHash = await hashPassword(password);
db.users[username].mustChangePassword = true;
delete db.users[username].password;
writeDB(db);
console.log(`Passwort für ${username} zurückgesetzt. Beim nächsten Login muss ein neues gesetzt werden.`);
