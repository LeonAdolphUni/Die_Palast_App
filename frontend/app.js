// Service Worker für die PWA (funktioniert nur über HTTPS oder localhost)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}

document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = window.location.origin;
    const ADMIN = 'Admin';
    const MIN_PASSWORD_LENGTH = 8;

    // State
    let currentUser = null;
    let authToken = localStorage.getItem('wg_token');
    let lastActivity = Date.now();
    let currentWeekOffset = 0;
    let selectedUserForLogin = null;
    let currentWeekData = null;
    let publicUsers = {};

    // --- DOM Elements ---

    // Views
    const loginView = document.getElementById('login-view');
    const setupView = document.getElementById('setup-view');
    const menuView = document.getElementById('menu-view');
    const putzplanView = document.getElementById('putzplan-view');
    const shoppingView = document.getElementById('shopping-view');
    const financeView = document.getElementById('finance-view');
    const adminView = document.getElementById('admin-view');

    // Login
    const userGrid = document.getElementById('user-grid');
    const passwordSection = document.getElementById('password-section');
    const passwordPrompt = document.getElementById('password-prompt');
    const passwordInput = document.getElementById('password-input');
    const loginSubmitBtn = document.getElementById('login-submit-btn');
    const loginBackBtn = document.getElementById('login-back-btn');
    const loginError = document.getElementById('login-error');

    // Setup (erster Login / nach Reset)
    const setupTitle = document.getElementById('setup-title');
    const setupSubtitle = document.getElementById('setup-subtitle');
    const setupPassword = document.getElementById('setup-password');
    const setupPasswordRepeat = document.getElementById('setup-password-repeat');
    const setupError = document.getElementById('setup-error');

    // Menu
    const menuUserName = document.getElementById('menu-user-name');
    const menuLogoutBtn = document.getElementById('menu-logout-btn');
    const menuPutzplanBtn = document.getElementById('menu-putzplan-btn');
    const menuShoppingBtn = document.getElementById('menu-shopping-btn');
    const menuFinanceBtn = document.getElementById('menu-finance-btn');
    const menuProfileBtn = document.getElementById('menu-profile-btn');
    const menuAdminBtn = document.getElementById('menu-admin-btn');

    // Putzplan
    const putzplanBackBtn = document.getElementById('putzplan-back-btn');
    const weekTitle = document.getElementById('current-week-title');
    const weekDate = document.getElementById('current-week-date');
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    const myTaskTitle = document.getElementById('my-task-title');
    const myTaskDesc = document.getElementById('my-task-desc');
    const allTasksGrid = document.getElementById('all-tasks-grid');
    const taskDoneCheckbox = document.getElementById('task-done-checkbox');

    // Shopping
    const shoppingBackBtn = document.getElementById('shopping-back-btn');
    const shoppingInput = document.getElementById('shopping-input');
    const shoppingAddBtn = document.getElementById('shopping-add-btn');
    const shoppingList = document.getElementById('shopping-list');
    const shoppingEmpty = document.getElementById('shopping-empty');

    // Finance
    const financeBackBtn = document.getElementById('finance-back-btn');
    const financeTotalBalance = document.getElementById('finance-total-balance');
    const financeDebtsList = document.getElementById('finance-debts-list');
    const financeExpensesList = document.getElementById('finance-expenses-list');
    const financeAddBtn = document.getElementById('finance-add-btn');

    // Admin
    const adminBackBtn = document.getElementById('admin-back-btn');
    const adminLogoutBtn = document.getElementById('admin-logout-btn');
    const adminUserList = document.getElementById('admin-user-list');
    const adminPasswordModal = document.getElementById('admin-password-modal');
    const adminUserModal = document.getElementById('admin-user-modal');

    // Modals
    const modalOverlay = document.getElementById('modal-overlay');
    const expenseModal = document.getElementById('expense-modal');
    const profileModal = document.getElementById('profile-modal');
    const passwordModal = document.getElementById('password-modal');

    // --- Init ---
    init();

    async function init() {
        setupEventListeners();
        try {
            await fetchFlatmates();
        } catch (err) {
            alert("Server nicht erreichbar!");
        }
        renderLogin();
        if (!authToken) return showLogin();
        try {
            const result = await apiJson('/api/me');
            if (result.success) await routeAfterLogin(result.data);
        } catch (err) {
            showLogin();
        }
    }

    // Wer muss wohin nach dem Login? Startpasswort ändern -> Setup, sonst Menü (+ einmalig Profil einrichten)
    async function routeAfterLogin(user) {
        currentUser = user.name;
        lastActivity = Date.now();
        if (user.mustChangePassword) return showSetup(user);
        await fetchPublicUsers();
        showMenu();
        if (!user.onboarded && !user.isAdmin) showProfile({ welcome: true });
    }

    // fetch mit Token; bei abgelaufener Sitzung -> Login, bei offenem Startpasswort -> Setup
    async function apiFetch(path, options = {}) {
        options.headers = { ...(options.headers || {}) };
        if (authToken) options.headers['Authorization'] = authToken;
        if (options.body !== undefined) options.headers['Content-Type'] = 'application/json';

        const res = await fetch(`${API_BASE}${path}`, options);

        if (res.status === 401) {
            logout();
            throw new Error("Sitzung abgelaufen");
        }
        if (res.status === 403) {
            const data = await res.clone().json().catch(() => ({}));
            if (data.code === 'PASSWORD_CHANGE_REQUIRED') {
                showSetup({ name: currentUser, onboarded: true });
                throw new Error(data.message);
            }
        }
        return res;
    }

    async function apiJson(path, method = 'GET', body) {
        const res = await apiFetch(path, { method, ...(body !== undefined && { body: JSON.stringify(body) }) });
        return res.json();
    }

    // Bewohner-Liste kommt vom Server (Reihenfolge = Putzplan-Rotation)
    async function fetchFlatmates() {
        const res = await fetch(`${API_BASE}/api/flatmates`);
        const result = await res.json();
        if (result.success) WG_DATA.flatmates = result.data;
    }

    async function fetchPublicUsers() {
        try {
            const result = await apiJson('/api/users/public');
            if (result.success) publicUsers = result.data;
        } catch (err) {
            console.error("Fetch error:", err);
        }
    }

    function setupEventListeners() {
        loginSubmitBtn.addEventListener('click', attemptLogin);
        passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') attemptLogin(); });
        loginBackBtn.addEventListener('click', () => {
            passwordSection.style.display = 'none';
            userGrid.style.display = 'grid';
            loginError.textContent = '';
            selectedUserForLogin = null;
        });

        document.getElementById('setup-save-btn').addEventListener('click', saveSetupPassword);
        setupPasswordRepeat.addEventListener('keypress', (e) => { if (e.key === 'Enter') saveSetupPassword(); });
        document.getElementById('setup-logout-btn').addEventListener('click', logout);

        const logouts = [menuLogoutBtn, document.getElementById('putzplan-logout-btn'), document.getElementById('shopping-logout-btn'), document.getElementById('finance-logout-btn'), adminLogoutBtn];
        logouts.forEach(btn => btn?.addEventListener('click', logout));

        menuPutzplanBtn.addEventListener('click', showPutzplan);
        menuShoppingBtn.addEventListener('click', showShopping);
        menuFinanceBtn.addEventListener('click', showFinance);
        menuProfileBtn.addEventListener('click', () => showProfile());
        menuAdminBtn.addEventListener('click', showAdmin);

        putzplanBackBtn.addEventListener('click', showMenu);
        prevWeekBtn.addEventListener('click', () => { currentWeekOffset--; updatePutzplan(); });
        nextWeekBtn.addEventListener('click', () => { currentWeekOffset++; updatePutzplan(); });
        taskDoneCheckbox.addEventListener('change', handleTaskToggle);

        shoppingBackBtn.addEventListener('click', showMenu);
        shoppingAddBtn.addEventListener('click', addShoppingItem);
        shoppingInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addShoppingItem(); });

        financeBackBtn.addEventListener('click', showMenu);
        financeAddBtn.addEventListener('click', () => openExpenseModal());

        adminBackBtn.addEventListener('click', showMenu);

        modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
        document.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', closeModal));

        document.getElementById('expense-split-type').addEventListener('change', renderExpenseSplits);
        document.getElementById('expense-amount').addEventListener('input', () => {
            if (document.getElementById('expense-split-type').value === 'equal') renderExpenseSplits();
        });
        document.getElementById('expense-save-btn').addEventListener('click', saveExpense);

        document.getElementById('profile-save-btn').addEventListener('click', saveProfile);
        document.getElementById('profile-pic-input').addEventListener('change', handleProfilePicChange);
        document.getElementById('profile-pic-btn').addEventListener('click', () => document.getElementById('profile-pic-input').click());
        document.getElementById('profile-pic-remove-btn').addEventListener('click', () => setProfilePicPreview(''));
        document.getElementById('profile-password-btn').addEventListener('click', openPasswordModal);
        document.getElementById('password-save-btn').addEventListener('click', saveOwnPassword);

        document.getElementById('admin-password-save-btn').addEventListener('click', saveAdminPassword);
        document.getElementById('admin-add-user-btn').addEventListener('click', () => openAdminUserModal());
        document.getElementById('admin-user-save-btn').addEventListener('click', saveAdminUser);
        document.getElementById('admin-own-password-btn').addEventListener('click', openPasswordModal);

        // Security: Aktivität tracken
        ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
            window.addEventListener(evt, () => { lastActivity = Date.now(); });
        });

        setInterval(checkSecurityTimeout, 30000); // Alle 30 Sek prüfen
    }

    function checkSecurityTimeout() {
        if (!currentUser) return;
        const thirtyMinutes = 30 * 60 * 1000;
        if (Date.now() - lastActivity > thirtyMinutes) {
            logout();
            alert("Du wurdest wegen Inaktivität ausgeloggt.");
        }
    }

    // --- Auth Logic ---
    function logout() {
        if (authToken) {
            // Sitzung auch auf dem Server beenden (Fehler egal, lokal wird trotzdem abgemeldet)
            fetch(`${API_BASE}/api/logout`, { method: 'POST', headers: { 'Authorization': authToken } }).catch(() => {});
        }
        localStorage.removeItem('wg_token');
        localStorage.removeItem('wg_user');
        currentUser = null;
        authToken = null;
        publicUsers = {};
        closeModal();
        showLogin();
    }

    async function attemptLogin() {
        const password = passwordInput.value;
        if (!password || !selectedUserForLogin) return;
        try {
            const res = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: selectedUserForLogin, password })
            });
            const result = await res.json();
            if (result.success) {
                authToken = result.token;
                localStorage.setItem('wg_token', authToken);
                passwordInput.value = '';
                loginError.textContent = '';
                await routeAfterLogin(result.user);
            } else {
                loginError.textContent = result.message || 'Falsches Passwort';
            }
        } catch (err) {
            console.error("Login Error:", err);
            alert("Login fehlgeschlagen. Ist der Server erreichbar?");
        }
    }

    function renderLogin() {
        userGrid.innerHTML = '';
        if (!WG_DATA || !WG_DATA.flatmates) return;
        WG_DATA.flatmates.concat([ADMIN]).forEach(name => {
            const btn = document.createElement('button');
            btn.className = 'user-btn glass-card';
            btn.textContent = name;
            btn.addEventListener('click', () => {
                selectedUserForLogin = name;
                userGrid.style.display = 'none';
                passwordSection.style.display = 'block';
                passwordPrompt.textContent = `Passwort für ${name}:`;
                passwordInput.focus();
            });
            userGrid.appendChild(btn);
        });
    }

    // Neues Passwort festlegen: beim ersten Login (onboarded=false) oder nach Admin-Reset
    function showSetup(user) {
        hideAllViews();
        setupView.classList.add('active');
        setupTitle.textContent = user.onboarded ? 'Neues Passwort' : `Willkommen, ${user.name}!`;
        setupSubtitle.textContent = user.onboarded
            ? 'Dein Passwort wurde zurückgesetzt. Bitte lege ein neues fest.'
            : 'Lege zuerst dein eigenes Passwort fest.';
        setupPassword.value = '';
        setupPasswordRepeat.value = '';
        setupError.textContent = '';
        setupPassword.focus();
    }

    async function saveSetupPassword() {
        const problem = checkPasswordInputs(setupPassword.value, setupPasswordRepeat.value);
        if (problem) { setupError.textContent = problem; return; }
        try {
            const result = await apiJson('/api/me/password', 'PUT', { newPassword: setupPassword.value });
            if (result.success) await routeAfterLogin(result.data);
            else setupError.textContent = result.message || 'Fehler beim Speichern.';
        } catch (err) { setupError.textContent = 'Fehler beim Speichern.'; }
    }

    function checkPasswordInputs(password, repeat) {
        if (password.length < MIN_PASSWORD_LENGTH) return `Mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`;
        if (password !== repeat) return 'Die Passwörter stimmen nicht überein.';
        return null;
    }

    // --- View Switching ---
    function hideAllViews() { document.querySelectorAll('.view').forEach(v => v.classList.remove('active')); }
    function showMenu() {
        hideAllViews();
        menuView.classList.add('active');
        menuUserName.textContent = currentUser;

        // Admin sieht NUR den Admin-Button, andere sehen ALLES AUẞER den Admin-Button
        const isAdmin = (currentUser === ADMIN);
        menuAdminBtn.style.display = isAdmin ? 'flex' : 'none';
        menuPutzplanBtn.style.display = isAdmin ? 'none' : 'flex';
        menuShoppingBtn.style.display = isAdmin ? 'none' : 'flex';
        menuFinanceBtn.style.display = isAdmin ? 'none' : 'flex';
        menuProfileBtn.style.display = isAdmin ? 'none' : 'flex';
    }
    function showLogin() { hideAllViews(); loginView.classList.add('active'); userGrid.style.display = 'grid'; passwordSection.style.display = 'none'; }
    function showPutzplan() { hideAllViews(); putzplanView.classList.add('active'); currentWeekOffset = 0; updatePutzplan(); }
    function showShopping() { hideAllViews(); shoppingView.classList.add('active'); loadShoppingList(); }
    function showFinance() { hideAllViews(); financeView.classList.add('active'); loadFinances(); }
    function showAdmin() {
        hideAllViews();
        adminView.classList.add('active');
        loadAdminUsers();
    }

    // --- Admin ---
    async function loadAdminUsers() {
        try {
            const result = await apiJson('/api/users');
            if (result.success) renderAdminUserList(result.data);
        } catch (err) {}
    }

    function renderAdminUserList(users) {
        adminUserList.innerHTML = '';
        users.forEach(({ name, mustChangePassword }) => {
            const div = document.createElement('div');
            div.className = 'finance-item glass-card';
            const status = mustChangePassword ? 'Hat noch kein eigenes Passwort' : 'Bewohner';
            div.innerHTML = `<div class="item-main"><div><div class="item-title">${esc(name)}</div><div class="item-subtitle">${status}</div></div></div>
                <div class="item-actions" style="width:100%; display:flex; flex-wrap:wrap; gap:10px; border-top:1px solid var(--border); padding-top:10px;">
                    <button class="btn-text btn-sm reset-pw-btn">PW zurücksetzen</button>
                    <button class="btn-text btn-sm replace-btn">Ersetzen</button>
                    <button class="btn-text btn-sm delete-btn" style="color:var(--error);">Löschen</button>
                </div>`;
            div.querySelector('.reset-pw-btn').addEventListener('click', () => openAdminPasswordModal(name));
            div.querySelector('.replace-btn').addEventListener('click', () => openAdminUserModal(name));
            div.querySelector('.delete-btn').addEventListener('click', () => deleteUser(name));
            adminUserList.appendChild(div);
        });
    }

    // Nach Änderungen: Admin-Liste und Login-Auswahl aktualisieren
    function applyFlatmates(flatmates) {
        WG_DATA.flatmates = flatmates;
        renderLogin();
        loadAdminUsers();
    }

    // Ohne "replaces": neuen Bewohner anlegen. Mit: Bewohner ersetzen (übernimmt den Platz im Putzplan)
    function openAdminUserModal(replaces = '') {
        document.getElementById('admin-user-replaces').value = replaces;
        document.getElementById('admin-user-title').textContent = replaces ? `${replaces} ersetzen` : 'Neuer Bewohner';
        document.getElementById('admin-user-hint').textContent = replaces
            ? `Übernimmt den Platz von ${replaces} im Putzplan. Alte Ausgaben und Schulden bleiben unter ${replaces}.`
            : 'Der Putzplan wird danach neu verteilt.';
        document.getElementById('admin-user-name').value = '';
        document.getElementById('admin-user-password').value = '';
        document.getElementById('admin-user-error').textContent = '';
        openModal(adminUserModal);
    }

    async function saveAdminUser() {
        const replaces = document.getElementById('admin-user-replaces').value;
        const username = document.getElementById('admin-user-name').value.trim();
        const password = document.getElementById('admin-user-password').value;
        const errorEl = document.getElementById('admin-user-error');
        if (!username || !password.trim()) { errorEl.textContent = 'Bitte Name und Startpasswort eingeben.'; return; }
        try {
            const result = await apiJson('/api/users', 'POST', { username, password, ...(replaces && { replaces }) });
            if (result.success) {
                applyFlatmates(result.data);
                closeModal();
            } else {
                errorEl.textContent = result.message || 'Fehler beim Speichern.';
            }
        } catch (err) { errorEl.textContent = 'Fehler beim Speichern.'; }
    }

    async function deleteUser(name) {
        if (!confirm(`${name} wirklich löschen?\n\nAlte Ausgaben und offene Schulden bleiben erhalten, der Putzplan wird neu verteilt.\nTipp: Für einen Nachzügler lieber "Ersetzen" nutzen.`)) return;
        try {
            const result = await apiJson(`/api/users/${encodeURIComponent(name)}`, 'DELETE');
            if (result.success) applyFlatmates(result.data);
            else alert(result.message || 'Fehler beim Löschen.');
        } catch (err) { alert('Fehler beim Löschen.'); }
    }

    function openAdminPasswordModal(name) {
        document.getElementById('admin-target-user').value = name;
        document.getElementById('admin-target-name').textContent = name;
        document.getElementById('admin-new-password').value = '';
        document.getElementById('admin-password-feedback').textContent = '';
        document.getElementById('admin-password-error').textContent = '';
        openModal(adminPasswordModal);
    }

    async function saveAdminPassword() {
        const username = document.getElementById('admin-target-user').value;
        const password = document.getElementById('admin-new-password').value;
        const errorEl = document.getElementById('admin-password-error');
        if (!password.trim()) { errorEl.textContent = 'Bitte ein vorläufiges Passwort eingeben.'; return; }
        try {
            const result = await apiJson(`/api/users/${encodeURIComponent(username)}/reset-password`, 'POST', { password });
            if (result.success) {
                document.getElementById('admin-password-feedback').textContent = 'Zurückgesetzt!';
                loadAdminUsers();
                setTimeout(closeModal, 1500);
            } else {
                errorEl.textContent = result.message || 'Fehler beim Speichern.';
            }
        } catch (err) { errorEl.textContent = 'Fehler beim Speichern.'; }
    }

    // --- Eigenes Passwort ändern ---
    function openPasswordModal() {
        ['password-current', 'password-new', 'password-repeat'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('password-feedback').textContent = '';
        document.getElementById('password-error').textContent = '';
        closeModal();
        openModal(passwordModal);
    }

    async function saveOwnPassword() {
        const currentPassword = document.getElementById('password-current').value;
        const newPassword = document.getElementById('password-new').value;
        const errorEl = document.getElementById('password-error');
        const problem = checkPasswordInputs(newPassword, document.getElementById('password-repeat').value);
        if (problem) { errorEl.textContent = problem; return; }
        try {
            const result = await apiJson('/api/me/password', 'PUT', { currentPassword, newPassword });
            if (result.success) {
                errorEl.textContent = '';
                document.getElementById('password-feedback').textContent = 'Passwort geändert!';
                setTimeout(closeModal, 1500);
            } else {
                errorEl.textContent = result.message || 'Fehler beim Speichern.';
            }
        } catch (err) { errorEl.textContent = 'Fehler beim Speichern.'; }
    }

    // --- Putzplan Logic ---
    function getWeekData(offsetOffset) {
        const startDate = new Date(WG_DATA.startDate);
        startDate.setHours(0, 0, 0, 0);

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        // Finde den Montag der aktuellen Woche
        const day = now.getDay(); // 0 = So, 1 = Mo...
        const diffToMonday = (day === 0 ? -6 : 1) - day;
        const currentMonday = new Date(now);
        currentMonday.setDate(now.getDate() + diffToMonday);

        let msPassed = currentMonday.getTime() - startDate.getTime();
        let weeksPassed = Math.floor(msPassed / (1000 * 60 * 60 * 24 * 7));
        let targetWeekIndex = weeksPassed + offsetOffset;
        const targetMonday = new Date(startDate);
        targetMonday.setDate(targetMonday.getDate() + (targetWeekIndex * 7));
        const targetSunday = new Date(targetMonday); targetSunday.setDate(targetSunday.getDate() + 6);
        const fmt = (d) => {
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            return `${dd}.${mm}.${d.getFullYear()}`;
        };
        const assignments = WG_DATA.roles.map((role, roleIndex) => {
            let pIdx = (roleIndex + targetWeekIndex) % WG_DATA.flatmates.length;
            if (pIdx < 0) pIdx += WG_DATA.flatmates.length;
            return { role, assignee: WG_DATA.flatmates[pIdx] };
        });
        let title = "Aktuelle Woche";
        if (offsetOffset === -1) title = "Vergangene Woche";
        else if (offsetOffset === 1) title = "Kommende Woche";
        else if (offsetOffset !== 0) title = `Woche ${targetWeekIndex + 1}`;
        return { title, dateString: `${fmt(targetMonday)} - ${fmt(targetSunday)}`, weekKey: `${targetMonday.getFullYear()}-W${String(targetWeekIndex).padStart(2, '0')}`, assignments };
    }

    async function updatePutzplan() {
        currentWeekData = getWeekData(currentWeekOffset);
        weekTitle.textContent = currentWeekData.title;
        weekDate.textContent = currentWeekData.dateString;
        let statuses = {};
        try {
            const result = await apiJson(`/api/tasks/${currentWeekData.weekKey}`);
            if (result.success) statuses = result.data;
        } catch (err) {}
        const myAsgn = currentWeekData.assignments.find(a => a.assignee === currentUser);
        if (myAsgn) {
            myTaskTitle.textContent = myAsgn.role.title;
            myTaskDesc.textContent = myAsgn.role.description;
            taskDoneCheckbox.checked = !!statuses[currentUser];
            const isPause = myAsgn.role.id === 'p';
            const isFuture = currentWeekOffset > 0;
            taskDoneCheckbox.disabled = isPause || isFuture;
            document.querySelector('.my-task').classList.toggle('is-pause', isPause);
        } else {
            // Mehr Bewohner als Aufgaben: wer keine Rolle hat, ist frei
            myTaskTitle.textContent = 'Frei';
            myTaskDesc.textContent = 'Diese Woche hast du keine Aufgabe.';
            taskDoneCheckbox.checked = false;
            taskDoneCheckbox.disabled = true;
            document.querySelector('.my-task').classList.add('is-pause');
        }
        allTasksGrid.innerHTML = '';
        currentWeekData.assignments.forEach(asgn => {
            const isMe = asgn.assignee === currentUser;
            const isDone = !!statuses[asgn.assignee];
            const card = document.createElement('div');
            card.className = `glass-card task-card ${isMe ? 'is-me' : ''} ${isDone ? 'is-done' : ''}`;
            card.innerHTML = `<div class="task-card-header"><span class="task-card-title">${esc(asgn.role.title)}</span></div><div style="margin-top:10px;font-size:0.9em;">${isDone ? '<span style="color:var(--success)">Erledigt</span>' : '<span style="color:var(--text-muted)">Offen</span>'}</div><div class="task-card-assignee">${isMe ? 'Du' : esc(asgn.assignee)}</div>`;
            allTasksGrid.appendChild(card);
        });
    }

    async function handleTaskToggle(e) {
        const isCompleted = e.target.checked;
        try {
            const result = await apiJson(`/api/tasks/${currentWeekData.weekKey}`, 'POST', { completed: isCompleted });
            if (!result.success) throw new Error(result.message);
            updatePutzplan();
        } catch (err) { e.target.checked = !isCompleted; }
    }

    // --- Shopping Logic ---
    async function loadShoppingList() {
        try {
            const result = await apiJson('/api/shopping');
            if (result.success) renderShoppingList(result.data);
        } catch (err) {
            console.error("Shopping Error:", err);
        }
    }
    function renderShoppingList(items) {
        shoppingList.innerHTML = '';
        shoppingEmpty.style.display = items.length === 0 ? 'block' : 'none';
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'shopping-item glass-card';
            div.innerHTML = `<span>${esc(item.text)}</span><button class="btn-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><polyline points="20 6 9 17 4 12"/></svg></button>`;
            div.querySelector('button').addEventListener('click', () => deleteShoppingItem(item.id));
            shoppingList.appendChild(div);
        });
    }
    async function addShoppingItem() {
        const text = shoppingInput.value.trim();
        if (!text) return;
        try {
            const result = await apiJson('/api/shopping', 'POST', { text });
            if (!result.success) return alert(result.message);
            shoppingInput.value = ''; loadShoppingList();
        } catch (err) {}
    }
    async function deleteShoppingItem(id) { try { await apiJson(`/api/shopping/${encodeURIComponent(id)}`, 'DELETE'); loadShoppingList(); } catch (err) {} }

    // --- Finance Logic ---
    async function loadFinances() {
        try {
            const result = await apiJson('/api/expenses');
            if (result.success) renderFinances(result.data);
        } catch (err) {}
    }
    function renderFinances(expenses) {
        const balances = {};
        WG_DATA.flatmates.forEach(name => balances[name] = 0);
        // Ehemalige Bewohner bleiben drin, damit ihre offenen Schulden sichtbar bleiben
        expenses.forEach(exp => {
            balances[exp.paidBy] = (balances[exp.paidBy] || 0) + exp.amount;
            for (const [user, share] of Object.entries(exp.splits)) { balances[user] = (balances[user] || 0) - share; }
        });
        const myBalance = balances[currentUser] || 0;
        financeTotalBalance.textContent = `${myBalance.toFixed(2)} €`;
        financeTotalBalance.style.color = myBalance >= 0 ? 'var(--success)' : 'var(--error)';
        renderDebts(balances);
        financeExpensesList.innerHTML = '';
        expenses.slice().reverse().forEach(exp => {
            const div = document.createElement('div');
            div.className = 'finance-item glass-card';
            const date = new Date(exp.date).toLocaleDateString('de-DE');
            let actionsHtml = '';
            // Gleiche Regel wie auf dem Server: wer die Ausgabe angelegt hat, oder Admin
            if (exp.addedBy === currentUser || currentUser === ADMIN) {
                actionsHtml = `<div class="item-actions" style="width:100%; display:flex; gap:10px; margin-top:10px; border-top:1px solid var(--border); padding-top:10px;">
                    <button class="btn-text btn-sm edit-btn" style="color:var(--accent);">Bearbeiten</button>
                    <button class="btn-text btn-sm delete-btn" style="color:var(--error);">Löschen</button>
                </div>`;
            }
            div.innerHTML = `<div class="item-main"><div><div class="item-title">${esc(exp.description)}</div><div class="item-subtitle">${esc(date)} • Bezahlt von ${esc(exp.paidBy)}</div></div><div class="item-amount">${Number(exp.amount).toFixed(2)} €</div></div>${actionsHtml}`;
            const delBtn = div.querySelector('.delete-btn');
            if (delBtn) delBtn.addEventListener('click', () => deleteExpense(exp.id));
            const editBtn = div.querySelector('.edit-btn');
            if (editBtn) editBtn.addEventListener('click', () => openExpenseModal(exp));
            financeExpensesList.appendChild(div);
        });
    }
    function renderDebts(balances) {
        financeDebtsList.innerHTML = '';
        const debtors = [], creditors = [];
        for (const [name, bal] of Object.entries(balances)) {
            if (bal < -0.01) debtors.push({ name, bal: -bal });
            if (bal > 0.01) creditors.push({ name, bal });
        }
        debtors.forEach(d => {
            creditors.forEach(c => {
                if (d.bal <= 0 || c.bal <= 0) return;
                const amount = Math.min(d.bal, c.bal);
                if (d.name === currentUser || c.name === currentUser) {
                    const row = document.createElement('div');
                    row.className = 'finance-item glass-card';
                    const isCreditor = c.name === currentUser;
                    const other = isCreditor ? d.name : c.name;
                    const text = isCreditor ? `${esc(other)} schuldet dir` : `Du schuldest ${esc(other)}`;
                    let settleBtn = '';
                    if (!isCreditor) {
                        const paypal = publicUsers[other]?.paypal;
                        const paypalLink = paypal ? `https://paypal.me/${encodeURIComponent(paypal)}/${amount.toFixed(2)}` : null;
                        settleBtn = `<div style="margin-top:10px;display:flex;gap:10px;width:100%;">
                            <button class="btn btn-primary btn-sm settle-btn" style="flex:1;">Als bezahlt markieren</button>
                            ${paypalLink ? `<a href="${esc(paypalLink)}" target="_blank" rel="noopener noreferrer" class="btn-paypal" style="flex:1;">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106z"/></svg>
                                PayPal
                            </a>` : ''}
                        </div>`;
                    }
                    row.innerHTML = `<div class="item-main"><div class="item-title">${text}</div><div class="item-amount">${amount.toFixed(2)} €</div></div>${settleBtn}`;
                    const btn = row.querySelector('.settle-btn');
                    if (btn) btn.addEventListener('click', () => settleDebt(other, amount));
                    financeDebtsList.appendChild(row);
                }
                d.bal -= amount; c.bal -= amount;
            });
        });
    }
    async function settleDebt(to, amount) {
        if (!confirm(`${amount.toFixed(2)} € an ${to} als bezahlt markieren?`)) return;
        try {
            const result = await apiJson('/api/expenses', 'POST', { description: `Schuldenbegleichung an ${to}`, amount, paidBy: currentUser, splits: { [to]: amount } });
            if (!result.success) alert(result.message);
            loadFinances();
        } catch (err) {}
    }
    async function deleteExpense(id) {
        if (!confirm('Diese Ausgabe wirklich löschen?')) return;
        try {
            const result = await apiJson(`/api/expenses/${encodeURIComponent(id)}`, 'DELETE');
            if (!result.success) alert(result.message);
            loadFinances();
        } catch (err) {}
    }

    // --- Modal Logic ---
    function openModal(modal) { modalOverlay.classList.add('active'); modal.classList.add('active'); }
    function closeModal() { modalOverlay.classList.remove('active'); document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); }
    function openExpenseModal(expense = null) {
        const title = document.getElementById('expense-modal-title');
        const descInput = document.getElementById('expense-desc');
        const amountInput = document.getElementById('expense-amount');
        const payerSelect = document.getElementById('expense-payer');
        const idInput = document.getElementById('editing-expense-id');
        payerSelect.innerHTML = WG_DATA.flatmates.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
        if (expense) {
            title.textContent = 'Ausgabe bearbeiten'; idInput.value = expense.id;
            descInput.value = expense.description; amountInput.value = expense.amount;
            payerSelect.value = expense.paidBy;
            document.getElementById('expense-split-type').value = 'equal';
        } else {
            title.textContent = 'Neue Ausgabe'; idInput.value = ''; descInput.value = ''; amountInput.value = ''; payerSelect.value = currentUser;
        }
        renderExpenseSplits(); openModal(expenseModal);
    }
    function renderExpenseSplits() {
        const container = document.getElementById('expense-split-list');
        const type = document.getElementById('expense-split-type').value;
        const amount = parseFloat(document.getElementById('expense-amount').value) || 0;
        container.innerHTML = '';
        if (!WG_DATA || !WG_DATA.flatmates) return;
        WG_DATA.flatmates.forEach(name => {
            const div = document.createElement('div'); div.className = 'split-row';
            if (type === 'equal') { const share = (amount / WG_DATA.flatmates.length).toFixed(2); div.innerHTML = `<span>${esc(name)}</span><span>${share} €</span>`; }
            else { div.innerHTML = `<span>${esc(name)}</span><input type="number" class="split-input input" data-user="${esc(name)}" placeholder="0.00" step="0.01">`; }
            container.appendChild(div);
        });
    }
    async function saveExpense() {
        const id = document.getElementById('editing-expense-id').value;
        const desc = document.getElementById('expense-desc').value.trim();
        const amount = parseFloat(document.getElementById('expense-amount').value);
        const payer = document.getElementById('expense-payer').value;
        const type = document.getElementById('expense-split-type').value;
        if (!desc || isNaN(amount) || amount <= 0) return alert('Bitte fülle alle Felder korrekt aus.');
        const splits = {};
        if (type === 'equal') { const share = amount / WG_DATA.flatmates.length; WG_DATA.flatmates.forEach(n => splits[n] = share); }
        else {
            let total = 0;
            document.querySelectorAll('.split-input').forEach(input => { const val = parseFloat(input.value) || 0; splits[input.dataset.user] = val; total += val; });
            if (Math.abs(total - amount) > 0.05) return alert('Summe der Anteile stimmt nicht mit Gesamtbetrag überein!');
        }
        const body = { description: desc, amount, paidBy: payer, splits };
        try {
            const result = id
                ? await apiJson(`/api/expenses/${encodeURIComponent(id)}`, 'PUT', body)
                : await apiJson('/api/expenses', 'POST', body);
            if (result.success) { closeModal(); loadFinances(); }
            else alert(result.message || 'Fehler beim Speichern.');
        } catch (err) { alert('Fehler beim Speichern.'); }
    }

    // --- Profile Logic ---
    // welcome: einmalige Einrichtung nach dem ersten Login (alles freiwillig)
    function showProfile({ welcome = false } = {}) {
        const user = publicUsers[currentUser] || {};
        document.getElementById('profile-title').textContent = welcome ? `Willkommen, ${currentUser}!` : 'Dein Profil';
        document.getElementById('profile-hint').style.display = welcome ? 'block' : 'none';
        document.getElementById('profile-password-btn').style.display = welcome ? 'none' : 'block';
        document.getElementById('profile-paypal-input').value = user.paypal || '';
        document.getElementById('profile-phone-input').value = user.phone || '';
        setProfilePicPreview(user.profilePic || '');
        document.getElementById('profile-feedback').textContent = '';
        document.getElementById('profile-error').textContent = '';
        openModal(profileModal);
        // Einrichtung gilt als erledigt, sobald sie einmal gezeigt wurde – auch wenn man sie schließt
        if (welcome) apiJson('/api/me/profile', 'PUT', {}).catch(() => {});
    }

    function setProfilePicPreview(src) {
        const preview = document.getElementById('profile-pic-preview');
        const placeholder = document.getElementById('profile-pic-placeholder');
        preview.src = src;
        preview.style.display = src ? 'block' : 'none';
        placeholder.style.display = src ? 'none' : 'flex';
    }

    // Bild im Browser auf 256x256 verkleinern, damit es klein genug für den Server ist
    function handleProfilePicChange(e) {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file || !file.type.startsWith('image/')) return;
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            const size = 256;
            const canvas = document.createElement('canvas');
            canvas.width = size; canvas.height = size;
            // Quadratisch zuschneiden (Mitte)
            const side = Math.min(img.width, img.height);
            canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
            URL.revokeObjectURL(url);
            setProfilePicPreview(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => { URL.revokeObjectURL(url); alert('Bild konnte nicht geladen werden.'); };
        img.src = url;
    }

    async function saveProfile() {
        const paypal = document.getElementById('profile-paypal-input').value.trim();
        const phone = document.getElementById('profile-phone-input').value.trim();
        const preview = document.getElementById('profile-pic-preview');
        const profilePic = preview.style.display === 'block' ? preview.src : '';
        const errorEl = document.getElementById('profile-error');

        try {
            const result = await apiJson('/api/me/profile', 'PUT', { paypal, phone, profilePic });
            if (result.success) {
                errorEl.textContent = '';
                document.getElementById('profile-feedback').textContent = 'Profil gespeichert!';
                fetchPublicUsers();
                setTimeout(closeModal, 1000);
            } else {
                errorEl.textContent = result.message || 'Fehler beim Speichern.';
            }
        } catch (err) { errorEl.textContent = 'Fehler beim Speichern.'; }
    }

    // --- Helpers ---
    function esc(str) { const d = document.createElement('div'); d.textContent = String(str ?? ''); return d.innerHTML.replace(/"/g, '&quot;'); }
});
