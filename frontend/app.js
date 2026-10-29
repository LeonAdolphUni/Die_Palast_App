// Anzeigefehler von Profilbildern einmal pro Seite ans Server-Log melden
let avatarErrorReported = false;
document.addEventListener('error', (e) => {
    const el = e.target;
    if (avatarErrorReported || el.tagName !== 'IMG' || !el.closest('.avatar')) return;
    avatarErrorReported = true;
    fetch('/api/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: 'avatarDisplay', name: 'img', message: `Bild wird nicht angezeigt: ${el.src.slice(0, 40)}` }),
    }).catch(() => {});
}, true);

// Service Worker für die PWA (funktioniert nur über HTTPS oder localhost)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}

document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = window.location.origin;
    const ADMIN = 'Admin';
    const MIN_PASSWORD_LENGTH = 8;
    const AVATAR_COLORS = 8;

    // State
    let currentUser = null;
    let authToken = localStorage.getItem('wg_token');
    let lastActivity = Date.now();
    let currentWeekOffset = 0;
    let currentWeekData = null;
    let selectedUserForLogin = null;
    let publicUsers = {};
    let loginPics = {}; // Profilbilder für die Login-Auswahl (ohne Anmeldung abrufbar)
    let picTarget = 'profile';     // Wohin ein ausgewähltes Foto gehört: 'profile' oder 'welcome'
    let welcomePic = '';
    let expenses = [];
    let selectedPayer = null;
    let splitType = 'equal';
    let editingSplits = null;      // Aufteilung der gerade bearbeiteten Ausgabe
    let menuTarget = null;

    const $ = (id) => document.getElementById(id);
    const money = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
    const signedMoney = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', signDisplay: 'exceptZero' });

    const ICON_CHECK = '<svg class="status-done" viewBox="0 0 24 24" role="img" aria-label="Erledigt"><circle cx="12" cy="12" r="11" fill="var(--green)"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const ICON_OPEN = '<svg class="status-open" viewBox="0 0 24 24" role="img" aria-label="Offen"><circle cx="12" cy="12" r="10.5" fill="none" stroke="var(--ring)" stroke-width="1.6"/></svg>';
    const ICON_BADGE = '<span class="avatar-badge" aria-label="erledigt"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>';
    const ICON_TICK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    const ICON_MORE = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="8" cy="12" r="0.6" fill="currentColor"/><circle cx="12" cy="12" r="0.6" fill="currentColor"/><circle cx="16" cy="12" r="0.6" fill="currentColor"/></svg>';
    const ICON_EXTERNAL = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';

    // --- DOM Elements ---

    const tabBar = $('tab-bar');
    const modalOverlay = $('modal-overlay');
    const contextMenu = $('context-menu');

    // Login
    const userList = $('user-list');
    const passwordInput = $('password-input');
    const loginError = $('login-error');

    // Setup (erster Login / nach Reset)
    const setupPassword = $('setup-password');
    const setupPasswordRepeat = $('setup-password-repeat');
    const setupError = $('setup-error');

    // Putzplan
    const taskDoneCheckbox = $('task-done-checkbox');

    // Einkauf
    const shoppingList = $('shopping-list');
    const shoppingInput = $('shopping-input');

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

    // Wer muss wohin nach dem Login? Startpasswort ändern -> Setup, danach einmalig Profil einrichten
    async function routeAfterLogin(user) {
        currentUser = user.name;
        lastActivity = Date.now();
        if (user.mustChangePassword) return showSetup(user);
        await fetchPublicUsers();
        if (user.isAdmin) return showAdmin();
        if (!user.onboarded) return showWelcome();
        showTab('home');
    }

    // fetch mit Token; bei abgelaufener Sitzung -> Login, bei offenem Startpasswort -> Setup
    async function apiFetch(path, options = {}) {
        options.headers = { ...(options.headers || {}) };
        if (authToken) options.headers['Authorization'] = authToken;
        if (options.body !== undefined && !options.headers['Content-Type']) options.headers['Content-Type'] = 'application/json';

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
        const [res, picsRes] = await Promise.all([
            fetch(`${API_BASE}/api/flatmates`),
            fetch(`${API_BASE}/api/flatmates/pics`).catch(() => null),
        ]);
        const result = await res.json();
        if (result.success) WG_DATA.flatmates = result.data;
        // Bilder sind nur Zierde für die Login-Auswahl – fehlen sie, bleibt es beim Anfangsbuchstaben
        const pics = picsRes && picsRes.ok ? await picsRes.json().catch(() => null) : null;
        if (pics?.success) loginPics = pics.data;
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
        // Login
        $('login-admin-btn').addEventListener('click', () => selectUser(ADMIN));
        $('login-back-btn').addEventListener('click', showLogin);
        $('login-form').addEventListener('submit', (e) => { e.preventDefault(); attemptLogin(); });

        // Setup & Willkommen
        $('setup-form').addEventListener('submit', (e) => { e.preventDefault(); saveSetupPassword(); });
        [setupPassword, setupPasswordRepeat].forEach(input => input.addEventListener('input', updateSetupChecks));
        $('setup-logout-btn').addEventListener('click', logout);
        bindPicLabel('welcome-pic-btn', 'welcome');
        $('welcome-save-btn').addEventListener('click', saveWelcome);
        $('welcome-skip-btn').addEventListener('click', () => showTab('home'));

        // Navigation: Tab-Leiste und alle Elemente mit data-tab (Karten, Avatar)
        document.querySelectorAll('[data-tab]').forEach(el => el.addEventListener('click', () => showTab(el.dataset.tab)));
        document.querySelectorAll('[data-action="logout"]').forEach(btn => btn.addEventListener('click', logout));

        // Übersicht & Putzplan
        $('home-task-btn').addEventListener('click', toggleHomeTask);
        $('prev-week-btn').addEventListener('click', () => { currentWeekOffset--; updatePutzplan(); });
        $('next-week-btn').addEventListener('click', () => { currentWeekOffset++; updatePutzplan(); });
        taskDoneCheckbox.addEventListener('change', handleTaskToggle);

        // Einkauf
        $('shopping-form').addEventListener('submit', (e) => { e.preventDefault(); addShoppingItem(); });
        $('docs-input').addEventListener('change', uploadDocument);
        $('docs-add-btn').addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            $('docs-input').click();
        });

        // Finanzen
        $('finance-add-btn').addEventListener('click', () => openExpenseModal());
        $('expense-save-btn').addEventListener('click', saveExpense);
        $('expense-delete-btn').addEventListener('click', deleteExpense);
        $('expense-amount').addEventListener('input', () => { if (splitType === 'equal') renderExpenseSplits(); });
        document.querySelectorAll('[data-split]').forEach(btn => btn.addEventListener('click', () => {
            splitType = btn.dataset.split;
            renderExpenseSplits();
        }));

        // Profil
        $('profile-pic-input').addEventListener('change', handleProfilePicChange);
        bindPicLabel('profile-pic-btn', 'profile');
        $('profile-pic-remove-btn').addEventListener('click', () => saveProfileFields({ profilePic: '' }));
        $('profile-paypal-input').addEventListener('change', (e) => saveProfileFields({ paypal: e.target.value.trim() }));
        $('profile-phone-input').addEventListener('change', (e) => saveProfileFields({ phone: e.target.value.trim() }));
        $('profile-password-btn').addEventListener('click', openPasswordModal);
        $('password-save-btn').addEventListener('click', saveOwnPassword);

        // Admin
        $('admin-add-user-btn').addEventListener('click', () => openAdminUserModal());
        $('admin-finance-btn').addEventListener('click', showAdminFinances);
        $('admin-finance-back-btn').addEventListener('click', showAdmin);
        $('admin-expense-add-btn').addEventListener('click', () => openExpenseModal());
        $('admin-own-password-btn').addEventListener('click', openPasswordModal);
        $('admin-password-save-btn').addEventListener('click', saveAdminPassword);
        $('admin-user-save-btn').addEventListener('click', saveAdminUser);
        contextMenu.addEventListener('click', (e) => {
            const item = e.target.closest('[data-menu]');
            if (!item || !menuTarget) return;
            const name = menuTarget;
            closeContextMenu();
            if (item.dataset.menu === 'reset') openAdminPasswordModal(name);
            if (item.dataset.menu === 'replace') openAdminUserModal(name);
            if (item.dataset.menu === 'delete') deleteUser(name);
        });
        document.addEventListener('click', (e) => {
            if (!contextMenu.hidden && !contextMenu.contains(e.target) && !e.target.closest('.more-btn')) closeContextMenu();
        });
        window.addEventListener('scroll', closeContextMenu, { passive: true });
        window.addEventListener('resize', closeContextMenu);

        // Sheets: Hintergrund/✕/Escape schließt, Enter in einem Feld sichert
        modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
        document.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', closeModal));
        modalOverlay.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                e.preventDefault();
                e.target.closest('.sheet').querySelector('.circle-btn-primary').click();
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            closeContextMenu();
            closeModal();
        });

        // Security: Aktivität tracken
        ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
            window.addEventListener(evt, () => { lastActivity = Date.now(); }, { passive: true });
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
        closeContextMenu();
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
        userList.innerHTML = '';
        WG_DATA.flatmates.forEach(name => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'row row-button';
            btn.innerHTML = `${avatarHtml(name, 'avatar-sm', { src: loginPics[name] || '' })}<span class="row-body"><span class="row-title">${esc(name)}</span><span class="chevron" aria-hidden="true"></span></span>`;
            btn.addEventListener('click', () => selectUser(name));
            userList.appendChild(btn);
        });
    }

    function selectUser(name) {
        selectedUserForLogin = name;
        $('login-avatar').outerHTML = avatarHtml(name, 'avatar-xl', { id: 'login-avatar', src: loginPics[name] || '' });
        $('login-hello').textContent = `Hallo, ${name}`;
        $('login-username').value = name;
        passwordInput.value = '';
        loginError.textContent = '';
        showView('password-view');
        passwordInput.focus();
    }

    // Neues Passwort festlegen: beim ersten Login (onboarded=false) oder nach Admin-Reset
    function showSetup(user) {
        const firstTime = !user.onboarded && !user.isAdmin;
        $('setup-title').textContent = user.onboarded ? 'Neues Passwort' : `Willkommen, ${user.name}!`;
        $('setup-subtitle').textContent = user.onboarded
            ? 'Dein Passwort wurde zurückgesetzt. Lege ein neues fest.'
            : 'Lege dein eigenes Passwort fest. Das Startpasswort vom Admin gilt danach nicht mehr.';
        $('setup-steps').hidden = !firstTime;
        $('setup-save-btn').textContent = firstTime ? 'Weiter' : 'Speichern';
        setupPassword.value = '';
        setupPasswordRepeat.value = '';
        setupError.textContent = '';
        updateSetupChecks();
        showView('setup-view');
        setupPassword.focus();
    }

    function updateSetupChecks() {
        const password = setupPassword.value;
        $('setup-check-length').classList.toggle('ok', password.length >= MIN_PASSWORD_LENGTH);
        $('setup-check-match').classList.toggle('ok', password.length > 0 && password === setupPasswordRepeat.value);
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

    // Einmalige Profil-Einrichtung (alles freiwillig)
    function showWelcome() {
        const user = publicUsers[currentUser] || {};
        welcomePic = user.profilePic || '';
        renderWelcomeAvatar();
        $('welcome-paypal').value = user.paypal || '';
        $('welcome-phone').value = user.phone || '';
        $('welcome-error').textContent = '';
        showView('welcome-view');
        // Einrichtung gilt als erledigt, sobald sie einmal gezeigt wurde – auch bei "Später"
        apiJson('/api/me/profile', 'PUT', {}).catch(() => {});
    }

    function renderWelcomeAvatar() {
        $('welcome-avatar').outerHTML = avatarHtml(currentUser, 'avatar-xl', { id: 'welcome-avatar', src: welcomePic });
        $('welcome-pic-btn').textContent = welcomePic ? 'Foto ändern' : 'Foto hinzufügen';
    }

    async function saveWelcome() {
        // Nur Geändertes mitschicken – so wird nie ein vorhandener Wert versehentlich geleert
        const saved = publicUsers[currentUser] || {};
        const body = {};
        const paypal = $('welcome-paypal').value.trim();
        const phone = $('welcome-phone').value.trim();
        if (paypal !== (saved.paypal || '')) body.paypal = paypal;
        if (phone !== (saved.phone || '')) body.phone = phone;
        if (welcomePic && welcomePic !== saved.profilePic) body.profilePic = welcomePic;
        try {
            const result = await apiJson('/api/me/profile', 'PUT', body);
            if (!result.success) { $('welcome-error').textContent = result.message || 'Fehler beim Speichern.'; return; }
            await fetchPublicUsers();
            showTab('home');
        } catch (err) { $('welcome-error').textContent = 'Fehler beim Speichern.'; }
    }

    // --- View Switching ---
    function showView(id) {
        document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id));
        tabBar.hidden = !$(id).classList.contains('app-view');
        window.scrollTo(0, 0);
    }

    function showLogin() {
        selectedUserForLogin = null;
        showView('login-view');
    }

    const TABS = {
        home: ['home-view', loadHome],
        putzplan: ['putzplan-view', () => { currentWeekOffset = 0; updatePutzplan(); }],
        shopping: ['shopping-view', loadShoppingList],
        finance: ['finance-view', loadFinances],
        profile: ['profile-view', renderProfile],
        docs: ['docs-view', loadDocuments],
    };

    function showTab(name) {
        if (!currentUser || currentUser === ADMIN) return;
        const [viewId, load] = TABS[name];
        showView(viewId);
        tabBar.querySelectorAll('.tab').forEach(tab => {
            const active = tab.dataset.tab === name;
            tab.classList.toggle('active', active);
            if (active) tab.setAttribute('aria-current', 'page');
            else tab.removeAttribute('aria-current');
        });
        load();
    }

    function showAdmin() {
        showView('admin-view');
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
        const list = $('admin-user-list');
        list.innerHTML = '';
        users.forEach(({ name, mustChangePassword }) => {
            const li = document.createElement('li');
            li.className = 'row row-tall';
            const status = mustChangePassword
                ? '<span class="badge">Startpasswort aktiv</span>'
                : '<span class="row-sub">Eigenes Passwort</span>';
            li.innerHTML = `${avatarHtml(name)}<span class="row-body"><span class="row-text"><span>${esc(name)}</span>${status}</span>
                <button type="button" class="more-btn" aria-label="Aktionen für ${esc(name)}" aria-haspopup="menu">${ICON_MORE}</button></span>`;
            li.querySelector('.more-btn').addEventListener('click', (e) => openContextMenu(name, e.currentTarget));
            list.appendChild(li);
        });
    }

    function openContextMenu(name, anchor) {
        if (menuTarget === name && !contextMenu.hidden) return closeContextMenu();
        menuTarget = name;
        contextMenu.setAttribute('aria-label', `Aktionen für ${name}`);
        contextMenu.hidden = false;
        const rect = anchor.getBoundingClientRect();
        const menuHeight = contextMenu.offsetHeight;
        const below = rect.bottom + 6 + menuHeight < window.innerHeight;
        contextMenu.style.top = `${below ? rect.bottom + 6 : Math.max(8, rect.top - menuHeight - 6)}px`;
        contextMenu.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
        contextMenu.querySelector('button').focus({ preventScroll: true });
    }

    function closeContextMenu() {
        contextMenu.hidden = true;
        menuTarget = null;
    }

    // Nach Änderungen: Admin-Liste und Login-Auswahl aktualisieren
    function applyFlatmates(flatmates) {
        WG_DATA.flatmates = flatmates;
        renderLogin();
        loadAdminUsers();
    }

    // Ohne "replaces": neuen Bewohner anlegen. Mit: Bewohner ersetzen (übernimmt den Platz im Putzplan)
    function openAdminUserModal(replaces = '') {
        $('admin-user-replaces').value = replaces;
        $('admin-user-title').textContent = replaces ? `${replaces} ersetzen` : 'Neuer Bewohner';
        $('admin-user-hint').textContent = replaces
            ? `Übernimmt den Platz von ${replaces} im Putzplan. Alte Ausgaben und Schulden bleiben unter ${replaces}.`
            : 'Der Putzplan wird danach neu verteilt.';
        $('admin-user-name').value = '';
        $('admin-user-password').value = '';
        $('admin-user-error').textContent = '';
        openModal($('admin-user-modal'));
        $('admin-user-name').focus();
    }

    async function saveAdminUser() {
        const replaces = $('admin-user-replaces').value;
        const username = $('admin-user-name').value.trim();
        const password = $('admin-user-password').value;
        const errorEl = $('admin-user-error');
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
        $('admin-target-user').value = name;
        $('admin-target-name').textContent = name;
        $('admin-new-password').value = '';
        $('admin-password-feedback').textContent = '';
        $('admin-password-error').textContent = '';
        openModal($('admin-password-modal'));
        $('admin-new-password').focus();
    }

    async function saveAdminPassword() {
        const username = $('admin-target-user').value;
        const password = $('admin-new-password').value;
        const errorEl = $('admin-password-error');
        if (!password.trim()) { errorEl.textContent = 'Bitte ein vorläufiges Passwort eingeben.'; return; }
        try {
            const result = await apiJson(`/api/users/${encodeURIComponent(username)}/reset-password`, 'POST', { password });
            if (result.success) {
                errorEl.textContent = '';
                $('admin-password-feedback').textContent = 'Zurückgesetzt!';
                loadAdminUsers();
                setTimeout(closeModal, 1200);
            } else {
                errorEl.textContent = result.message || 'Fehler beim Speichern.';
            }
        } catch (err) { errorEl.textContent = 'Fehler beim Speichern.'; }
    }

    // --- Eigenes Passwort ändern ---
    function openPasswordModal() {
        ['password-current', 'password-new', 'password-repeat'].forEach(id => $(id).value = '');
        $('password-feedback').textContent = '';
        $('password-error').textContent = '';
        closeModal();
        openModal($('password-modal'));
        $('password-current').focus();
    }

    async function saveOwnPassword() {
        const currentPassword = $('password-current').value;
        const newPassword = $('password-new').value;
        const errorEl = $('password-error');
        const problem = checkPasswordInputs(newPassword, $('password-repeat').value);
        if (problem) { errorEl.textContent = problem; return; }
        try {
            const result = await apiJson('/api/me/password', 'PUT', { currentPassword, newPassword });
            if (result.success) {
                errorEl.textContent = '';
                $('password-feedback').textContent = 'Passwort geändert!';
                setTimeout(closeModal, 1200);
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
        const assignments = WG_DATA.roles.map((role, roleIndex) => {
            let pIdx = (roleIndex + targetWeekIndex) % WG_DATA.flatmates.length;
            if (pIdx < 0) pIdx += WG_DATA.flatmates.length;
            return { role, assignee: WG_DATA.flatmates[pIdx] };
        });
        let title = "Diese Woche";
        if (offsetOffset === -1) title = "Letzte Woche";
        else if (offsetOffset === 1) title = "Nächste Woche";
        else if (offsetOffset !== 0) title = offsetOffset < 0 ? `Vor ${-offsetOffset} Wochen` : `In ${offsetOffset} Wochen`;
        const isoWeek = getIsoWeek(targetMonday);
        return {
            title,
            isoWeek,
            dateString: `${formatRange(targetMonday, targetSunday)} · KW ${isoWeek}`,
            weekKey: `${targetMonday.getFullYear()}-W${String(targetWeekIndex).padStart(2, '0')}`,
            assignments
        };
    }

    function getIsoWeek(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    }

    // "20.–26. Oktober" bzw. "27. Okt. – 2. Nov."
    function formatRange(from, to) {
        if (from.getMonth() === to.getMonth()) {
            return `${from.getDate()}.–${to.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}`;
        }
        const short = { day: 'numeric', month: 'short' };
        return `${from.toLocaleDateString('de-DE', short)} – ${to.toLocaleDateString('de-DE', short)}`;
    }

    async function fetchTaskStatuses(weekKey) {
        try {
            const result = await apiJson(`/api/tasks/${weekKey}`);
            if (result.success) return result.data;
        } catch (err) {}
        return {};
    }

    async function updatePutzplan() {
        const week = currentWeekData = getWeekData(currentWeekOffset);
        $('current-week-title').textContent = week.title;
        $('current-week-date').textContent = week.dateString;
        const statuses = await fetchTaskStatuses(week.weekKey);
        if (week !== currentWeekData) return; // schon weitergeblättert

        const myAsgn = week.assignments.find(a => a.assignee === currentUser);
        const isPause = !myAsgn || myAsgn.role.id === 'p';
        const isFuture = currentWeekOffset > 0;
        // Mehr Bewohner als Aufgaben: wer keine Rolle hat, ist frei
        $('my-task-title').textContent = myAsgn ? myAsgn.role.title : 'Frei';
        $('my-task-desc').textContent = myAsgn ? myAsgn.role.description : 'Diese Woche hast du keine Aufgabe.';
        taskDoneCheckbox.checked = !isPause && !!statuses[currentUser];
        taskDoneCheckbox.disabled = isPause || isFuture;
        $('task-done-row').classList.toggle('is-disabled', taskDoneCheckbox.disabled);

        const list = $('all-tasks-list');
        list.innerHTML = '';
        week.assignments.forEach(asgn => {
            const isMe = asgn.assignee === currentUser;
            const status = asgn.role.id === 'p'
                ? '<span class="status-free">Frei</span>'
                : (statuses[asgn.assignee] ? ICON_CHECK : ICON_OPEN);
            const li = document.createElement('li');
            li.className = `row row-tall ${isMe ? 'task-mine' : ''}`;
            li.innerHTML = `${avatarHtml(asgn.assignee)}<span class="row-body"><span class="row-text"><span>${esc(asgn.role.title)}</span>
                <span class="row-sub ${isMe ? 'row-sub-me' : ''}">${isMe ? 'Du' : esc(asgn.assignee)}</span></span>${status}</span>`;
            list.appendChild(li);
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

    // --- Übersicht ---
    async function loadHome() {
        $('home-date').textContent = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
        $('home-avatar').innerHTML = '';
        $('home-avatar').className = `avatar avatar-md avatar-button ${avatarColor(currentUser)}`;
        fillAvatar($('home-avatar'), currentUser);

        const week = getWeekData(0);
        $('home-week').textContent = `KW ${week.isoWeek}`;
        const [statuses, shopping, expenseList, docs] = await Promise.all([
            fetchTaskStatuses(week.weekKey),
            apiJson('/api/shopping').then(r => r.success ? r.data : null).catch(() => null),
            apiJson('/api/expenses').then(r => r.success ? r.data : null).catch(() => null),
            apiJson('/api/documents').then(r => r.success ? r.data : null).catch(() => null),
        ]);

        renderHomeTask(week, statuses);

        const shoppingEl = $('home-shopping');
        shoppingEl.textContent = shopping === null ? '–' : (shopping.length === 0 ? 'Alles da' : `${shopping.length} ${shopping.length === 1 ? 'Ding' : 'Dinge'}`);

        $('home-docs').textContent = docs === null ? '' : (docs.length === 0 ? 'Noch leer' : `${docs.length} ${docs.length === 1 ? 'Datei' : 'Dateien'}`);

        const balanceEl = $('home-balance');
        if (expenseList === null) {
            balanceEl.textContent = '–';
        } else {
            const balance = computeBalances(expenseList)[currentUser] || 0;
            balanceEl.textContent = signedMoney.format(roundCents(balance));
            balanceEl.className = `stat-value ${balanceClass(balance)}`;
        }

        // Alle Bewohner mit ihrer Aufgabe der Woche
        const wg = $('home-wg');
        wg.innerHTML = '';
        WG_DATA.flatmates.forEach(name => {
            const asgn = week.assignments.find(a => a.assignee === name);
            const isMe = name === currentUser;
            const done = asgn && asgn.role.id !== 'p' && statuses[name];
            const person = document.createElement('span');
            person.className = 'wg-person';
            person.innerHTML = `${avatarHtml(name, 'avatar-lg', { extraClass: isMe ? 'is-me' : '', badge: done })}
                <span class="wg-name ${isMe ? 'me' : ''}">${isMe ? 'Du' : esc(name)}</span>
                <span class="wg-role">${asgn ? esc(asgn.role.short) : 'Frei'}</span>`;
            wg.appendChild(person);
        });
    }

    function renderHomeTask(week, statuses) {
        const myAsgn = week.assignments.find(a => a.assignee === currentUser);
        const isPause = !myAsgn || myAsgn.role.id === 'p';
        const done = !isPause && !!statuses[currentUser];
        $('home-task-title').textContent = myAsgn ? myAsgn.role.title : 'Frei';
        $('home-task-desc').textContent = myAsgn ? myAsgn.role.description : 'Diese Woche hast du keine Aufgabe.';
        const btn = $('home-task-btn');
        btn.hidden = isPause;
        btn.classList.toggle('is-done', done);
        btn.setAttribute('aria-pressed', String(done));
        btn.innerHTML = done ? `${ICON_TICK} Erledigt` : `${ICON_TICK} Als erledigt markieren`;
        btn.dataset.weekKey = week.weekKey;
        btn.dataset.done = String(done);
    }

    async function toggleHomeTask() {
        const btn = $('home-task-btn');
        btn.disabled = true;
        try {
            const result = await apiJson(`/api/tasks/${btn.dataset.weekKey}`, 'POST', { completed: btn.dataset.done !== 'true' });
            if (!result.success) alert(result.message);
            await loadHome();
        } catch (err) {}
        btn.disabled = false;
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
        $('shopping-count').textContent = items.length || '';
        $('shopping-count').setAttribute('aria-label', `${items.length} offen`);
        $('shopping-empty').hidden = items.length > 0;
        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'check-row';
            li.innerHTML = `<button type="button" class="check-circle" aria-label="${esc(item.text)} abhaken"></button><span class="check-text">${esc(item.text)}</span>`;
            li.querySelector('button').addEventListener('click', () => checkShoppingItem(li, item.id), { once: true });
            shoppingList.appendChild(li);
        });
    }

    // Abhaken: kurz als erledigt zeigen, dann von der Liste nehmen
    async function checkShoppingItem(li, id) {
        li.classList.add('is-checked', 'is-leaving');
        const wait = new Promise(resolve => setTimeout(resolve, 750));
        try { await apiJson(`/api/shopping/${encodeURIComponent(id)}`, 'DELETE'); } catch (err) {}
        await wait;
        loadShoppingList();
    }

    async function addShoppingItem() {
        const text = shoppingInput.value.trim();
        if (!text) return;
        try {
            const result = await apiJson('/api/shopping', 'POST', { text });
            if (!result.success) return alert(result.message);
            shoppingInput.value = '';
            loadShoppingList();
        } catch (err) {}
    }

    // --- WG-Unterlagen ---
    const fileSize = (bytes) => bytes < 1024 * 1024
        ? `${Math.max(1, Math.round(bytes / 1024))} KB`
        : `${(bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
    const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
    const DOCS_HINT = 'Mietvertrag, Rechnungen, Hausordnung … Antippen lädt die Datei herunter. Max. 10 MB pro Datei.';

    function setDocsStatus(text, isError = false) {
        const el = $('docs-status');
        el.textContent = text || DOCS_HINT;
        el.classList.toggle('negative', isError);
    }

    async function loadDocuments() {
        setDocsStatus('');
        try {
            const result = await apiJson('/api/documents');
            if (result.success) renderDocuments(result.data);
        } catch (err) {
            console.error('Unterlagen:', err);
        }
    }

    function renderDocuments(docs) {
        const listEl = $('docs-list');
        listEl.innerHTML = '';
        docs.slice().reverse().forEach(doc => {
            const date = new Date(doc.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
            const by = doc.uploadedBy === currentUser ? 'Du' : doc.uploadedBy;
            const deletable = currentUser === ADMIN || doc.uploadedBy === currentUser;
            const li = document.createElement('li');
            li.className = 'row row-tall row-tappable';
            li.innerHTML = `<span class="tile icon-gray" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg></span>
                <span class="row-body"><span class="row-text"><span>${esc(doc.name)}</span>
                <span class="row-sub">${esc(by)} · ${esc(date)} · ${fileSize(doc.size)}</span></span>
                ${deletable ? '<button type="button" class="btn-link btn-link-danger doc-delete">Löschen</button>' : ''}</span>`;
            li.tabIndex = 0;
            li.setAttribute('role', 'button');
            li.setAttribute('aria-label', `${doc.name} herunterladen`);
            li.addEventListener('click', (e) => { if (!e.target.closest('.doc-delete')) downloadDocument(doc); });
            li.addEventListener('keydown', (e) => {
                if (e.target === li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); downloadDocument(doc); }
            });
            li.querySelector('.doc-delete')?.addEventListener('click', () => deleteDocument(doc));
            listEl.appendChild(li);
        });
        if (docs.length === 0) listEl.innerHTML = '<li class="empty-row">Noch keine Unterlagen.</li>';
    }

    async function uploadDocument(e) {
        const input = e.target;
        const file = input.files[0];
        if (!file) return;
        if (file.size > MAX_DOCUMENT_SIZE) {
            input.value = '';
            return setDocsStatus(`„${file.name}“ ist zu groß (${fileSize(file.size)}). Maximal 10 MB.`, true);
        }
        setDocsStatus(`„${file.name}“ wird hochgeladen …`);
        try {
            // Als neutraler Typ schicken, sonst würde der JSON-Parser des Servers z. B. .json-Dateien abfangen
            const res = await apiFetch('/api/documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
                body: file,
            });
            const result = await res.json().catch(() => ({ success: false, message: res.status === 413 ? 'Die Datei ist zu groß.' : 'Fehler beim Hochladen.' }));
            if (!result.success) return setDocsStatus(result.message || 'Fehler beim Hochladen.', true);
            await loadDocuments();
            setDocsStatus(`„${file.name}“ wurde hochgeladen.`);
        } catch (err) {
            setDocsStatus('Fehler beim Hochladen.', true);
        } finally {
            // Erst nach dem Lesen leeren: iOS Safari macht Dateien sonst unlesbar
            input.value = '';
        }
    }

    // Download über fetch, weil der Server den Anmelde-Token im Header braucht
    async function downloadDocument(doc) {
        setDocsStatus(`„${doc.name}“ wird geladen …`);
        try {
            const res = await apiFetch(`/api/documents/${encodeURIComponent(doc.id)}`);
            if (!res.ok) {
                const result = await res.json().catch(() => ({}));
                return setDocsStatus(result.message || 'Fehler beim Herunterladen.', true);
            }
            const url = URL.createObjectURL(await res.blob());
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
            setDocsStatus('');
        } catch (err) {
            setDocsStatus('Fehler beim Herunterladen.', true);
        }
    }

    async function deleteDocument(doc) {
        if (!confirm(`„${doc.name}“ wirklich löschen?`)) return;
        try {
            const result = await apiJson(`/api/documents/${encodeURIComponent(doc.id)}`, 'DELETE');
            if (!result.success) return setDocsStatus(result.message || 'Fehler beim Löschen.', true);
            loadDocuments();
        } catch (err) {
            setDocsStatus('Fehler beim Löschen.', true);
        }
    }

    // --- Finance Logic ---
    async function loadFinances() {
        try {
            const result = await apiJson('/api/expenses');
            if (result.success) renderFinances(result.data);
        } catch (err) {}
    }

    function computeBalances(list) {
        const balances = {};
        WG_DATA.flatmates.forEach(name => balances[name] = 0);
        // Ehemalige Bewohner bleiben drin, damit ihre offenen Schulden sichtbar bleiben
        list.forEach(exp => {
            balances[exp.paidBy] = (balances[exp.paidBy] || 0) + exp.amount;
            for (const [user, share] of Object.entries(exp.splits)) { balances[user] = (balances[user] || 0) - share; }
        });
        return balances;
    }

    function renderFinances(list) {
        expenses = list;
        const balances = computeBalances(list);
        const myBalance = balances[currentUser] || 0;
        const balanceEl = $('finance-total-balance');
        balanceEl.textContent = signedMoney.format(roundCents(myBalance));
        balanceEl.className = `balance-amount ${balanceClass(myBalance)}`;
        $('finance-balance-text').textContent = myBalance > 0.005 ? 'Du bekommst insgesamt Geld zurück.'
            : myBalance < -0.005 ? 'Du schuldest insgesamt Geld.' : 'Alles ausgeglichen.';
        renderDebts(balances);
        $('finance-expenses-hint').hidden = !renderExpenseRows($('finance-expenses-list'), list);
    }

    // Ausgaben als Liste (neueste zuerst); antippbar, wer sie bearbeiten darf. Gibt zurück, ob eine antippbar ist
    function renderExpenseRows(listEl, list) {
        listEl.innerHTML = '';
        let anyEditable = false;
        list.slice().reverse().forEach(exp => {
            // Gleiche Regel wie auf dem Server: wer die Ausgabe angelegt hat (alte ohne addedBy: wer bezahlt hat), oder Admin
            const editable = currentUser === ADMIN || (exp.addedBy ? exp.addedBy === currentUser : exp.paidBy === currentUser);
            anyEditable ||= editable;
            const date = new Date(exp.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
            const payer = exp.paidBy === currentUser ? 'Du' : exp.paidBy;
            const li = document.createElement('li');
            li.className = `row row-tall ${editable ? 'row-tappable' : ''}`;
            li.innerHTML = `${avatarHtml(exp.paidBy)}<span class="row-body"><span class="row-text"><span>${esc(exp.description)}</span>
                <span class="row-sub">${esc(payer)} · ${esc(date)}</span></span>
                <span class="row-value">${money.format(Number(exp.amount))}</span>${editable ? '<span class="chevron" aria-hidden="true"></span>' : ''}</span>`;
            if (editable) {
                li.tabIndex = 0;
                li.setAttribute('role', 'button');
                li.setAttribute('aria-label', `${exp.description} bearbeiten`);
                li.addEventListener('click', () => openExpenseModal(exp));
                li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openExpenseModal(exp); } });
            }
            listEl.appendChild(li);
        });
        if (list.length === 0) listEl.innerHTML = '<li class="empty-row">Noch keine Ausgaben.</li>';
        return anyEditable;
    }

    // Nach Speichern/Löschen die Ansicht neu laden, aus der die Ausgabe geöffnet wurde
    function reloadExpenses() {
        if (currentUser === ADMIN) loadAdminFinances();
        else loadFinances();
    }

    // --- Admin: alle Ausgaben ---
    function showAdminFinances() {
        showView('admin-finance-view');
        loadAdminFinances();
    }

    async function loadAdminFinances() {
        try {
            const result = await apiJson('/api/expenses');
            if (result.success) renderAdminFinances(result.data);
        } catch (err) {}
    }

    function renderAdminFinances(list) {
        expenses = list;
        const balances = computeBalances(list);
        // Aktuelle Bewohner zuerst, danach ehemalige, solange sie noch etwas offen haben
        const former = Object.keys(balances).filter(n => !WG_DATA.flatmates.includes(n) && Math.abs(balances[n]) > 0.005);
        const listEl = $('admin-balances');
        listEl.innerHTML = '';
        WG_DATA.flatmates.concat(former).forEach(name => {
            const value = roundCents(balances[name] || 0);
            const li = document.createElement('li');
            li.className = 'row';
            li.innerHTML = `${avatarHtml(name, 'avatar-sm')}<span class="row-body"><span class="row-text"><span>${esc(name)}</span>
                ${former.includes(name) ? '<span class="row-sub">ausgezogen</span>' : ''}</span>
                <span class="row-value ${balanceClass(value)}">${signedMoney.format(value)}</span></span>`;
            listEl.appendChild(li);
        });
        renderExpenseRows($('admin-expenses-list'), list);
    }

    function renderDebts(balances) {
        const listEl = $('finance-debts-list');
        listEl.innerHTML = '';
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
                    const isCreditor = c.name === currentUser;
                    const other = isCreditor ? d.name : c.name;
                    const text = isCreditor ? `${esc(other)} schuldet dir` : `Du schuldest ${esc(other)}`;
                    let actions = '';
                    if (!isCreditor) {
                        const paypal = publicUsers[other]?.paypal;
                        const paypalLink = paypal ? `https://paypal.me/${encodeURIComponent(paypal)}/${amount.toFixed(2)}` : null;
                        actions = `<div class="debt-actions">
                            ${paypalLink ? `<a href="${esc(paypalLink)}" target="_blank" rel="noopener noreferrer" class="pill pill-soft">PayPal ${ICON_EXTERNAL}</a>` : ''}
                            <button type="button" class="pill pill-primary settle-btn">Bezahlt</button>
                        </div>`;
                    }
                    const row = document.createElement('div');
                    row.className = 'debt-row';
                    row.innerHTML = `${avatarHtml(other)}<div class="debt-body"><div class="debt-line"><span>${text}</span>
                        <span class="debt-amount ${isCreditor ? 'positive' : 'negative'}">${money.format(amount)}</span></div>${actions}</div>`;
                    const btn = row.querySelector('.settle-btn');
                    if (btn) btn.addEventListener('click', () => settleDebt(other, amount));
                    listEl.appendChild(row);
                }
                d.bal -= amount; c.bal -= amount;
            });
        });
        if (!listEl.children.length) listEl.innerHTML = '<div class="empty-row">Keine offenen Beträge.</div>';
    }

    async function settleDebt(to, amount) {
        if (!confirm(`${money.format(amount)} an ${to} als bezahlt markieren?`)) return;
        try {
            const result = await apiJson('/api/expenses', 'POST', { description: `Schuldenbegleichung an ${to}`, amount, paidBy: currentUser, splits: { [to]: amount } });
            if (!result.success) alert(result.message);
            loadFinances();
        } catch (err) {}
    }

    async function deleteExpense() {
        const id = $('editing-expense-id').value;
        if (!id || !confirm('Diese Ausgabe wirklich löschen?')) return;
        try {
            const result = await apiJson(`/api/expenses/${encodeURIComponent(id)}`, 'DELETE');
            if (!result.success) { $('expense-error').textContent = result.message || 'Fehler beim Löschen.'; return; }
            closeModal();
            reloadExpenses();
        } catch (err) { $('expense-error').textContent = 'Fehler beim Löschen.'; }
    }

    // --- Modal Logic ---
    function openModal(modal) { modalOverlay.classList.add('active'); modal.classList.add('active'); }
    function closeModal() { modalOverlay.classList.remove('active'); document.querySelectorAll('.sheet').forEach(m => m.classList.remove('active')); }

    function openExpenseModal(expense = null) {
        $('expense-modal-title').textContent = expense ? 'Ausgabe bearbeiten' : 'Neue Ausgabe';
        $('editing-expense-id').value = expense ? expense.id : '';
        $('expense-desc').value = expense ? expense.description : '';
        $('expense-amount').value = expense ? Number(expense.amount).toFixed(2).replace('.', ',') : '';
        $('expense-delete-btn').hidden = !expense;
        $('expense-error').textContent = '';
        // Der Admin zahlt nie selbst – er muss den Zahler auswählen
        selectedPayer = expense ? expense.paidBy : (currentUser === ADMIN ? null : currentUser);
        // Bestehende Aufteilung beibehalten (z. B. mit ehemaligen Bewohnern), statt sie still zu überschreiben
        editingSplits = expense ? expense.splits : null;
        splitType = expense && !isEqualSplit(expense) ? 'custom' : 'equal';
        renderPayerPicker(expense);
        renderExpenseSplits();
        openModal($('expense-modal'));
        if (!expense) $('expense-amount').focus();
    }

    function renderPayerPicker(expense) {
        const picker = $('expense-payer');
        const names = WG_DATA.flatmates.slice();
        // Ehemalige Bewohner bleiben bei alten Ausgaben auswählbar
        if (expense && !names.includes(expense.paidBy)) names.push(expense.paidBy);
        picker.innerHTML = '';
        names.forEach(name => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'payer';
            btn.setAttribute('role', 'radio');
            btn.setAttribute('aria-checked', String(name === selectedPayer));
            btn.innerHTML = `${avatarHtml(name)}<span>${name === currentUser ? 'Du' : esc(name)}</span>`;
            btn.addEventListener('click', () => {
                selectedPayer = name;
                picker.querySelectorAll('.payer').forEach(b => b.setAttribute('aria-checked', String(b === btn)));
            });
            picker.appendChild(btn);
        });
    }

    // Gleichmäßig = genau die aktuellen Bewohner, alle mit demselben Anteil
    function isEqualSplit(expense) {
        const n = WG_DATA.flatmates.length;
        const names = Object.keys(expense.splits);
        return names.length === n && WG_DATA.flatmates.every(f => Math.abs((expense.splits[f] ?? -1) - expense.amount / n) < 0.01);
    }

    function renderExpenseSplits() {
        document.querySelectorAll('[data-split]').forEach(btn => btn.setAttribute('aria-selected', String(btn.dataset.split === splitType)));
        const container = $('expense-split-list');
        const amount = parseAmount($('expense-amount').value) || 0;
        container.innerHTML = '';
        if (splitType === 'equal') {
            WG_DATA.flatmates.forEach(name => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${esc(name)}</span><span class="split-share">${money.format(amount / WG_DATA.flatmates.length)}</span>`;
                container.appendChild(li);
            });
            return;
        }
        // Individuell: beim Bearbeiten auch ehemalige Bewohner aus der alten Aufteilung, mit ihren Beträgen
        const names = WG_DATA.flatmates.concat(Object.keys(editingSplits || {}).filter(n => !WG_DATA.flatmates.includes(n)));
        names.forEach((name, i) => {
            const share = editingSplits?.[name];
            const li = document.createElement('li');
            li.innerHTML = `<label for="split-${i}">${esc(name)}</label><input type="text" inputmode="decimal" id="split-${i}" class="split-input" data-user="${esc(name)}" placeholder="0,00" autocomplete="off"
                value="${share ? esc(roundCents(share).toFixed(2).replace('.', ',')) : ''}">`;
            container.appendChild(li);
        });
    }

    async function saveExpense() {
        const errorEl = $('expense-error');
        const id = $('editing-expense-id').value;
        const desc = $('expense-desc').value.trim();
        const amount = parseAmount($('expense-amount').value);
        if (isNaN(amount) || amount <= 0) { errorEl.textContent = 'Bitte einen Betrag eingeben.'; return; }
        if (!desc) { errorEl.textContent = 'Wofür war die Ausgabe?'; return; }
        if (!selectedPayer) { errorEl.textContent = 'Wer hat bezahlt?'; return; }
        const splits = {};
        if (splitType === 'equal') {
            const share = amount / WG_DATA.flatmates.length;
            WG_DATA.flatmates.forEach(n => splits[n] = share);
        } else {
            let total = 0;
            document.querySelectorAll('.split-input').forEach(input => {
                const val = parseAmount(input.value) || 0;
                if (val > 0) splits[input.dataset.user] = val;   // leere Anteile gar nicht erst speichern
                total += val;
            });
            if (Math.abs(total - amount) > 0.05) {
                errorEl.textContent = `Die Anteile ergeben ${money.format(total)}, nicht ${money.format(amount)}.`;
                return;
            }
        }
        const body = { description: desc, amount, paidBy: selectedPayer, splits };
        try {
            const result = id
                ? await apiJson(`/api/expenses/${encodeURIComponent(id)}`, 'PUT', body)
                : await apiJson('/api/expenses', 'POST', body);
            if (result.success) { closeModal(); reloadExpenses(); }
            else errorEl.textContent = result.message || 'Fehler beim Speichern.';
        } catch (err) { errorEl.textContent = 'Fehler beim Speichern.'; }
    }

    // --- Profile Logic ---
    function renderProfile() {
        const user = publicUsers[currentUser] || {};
        $('profile-avatar').outerHTML = avatarHtml(currentUser, 'avatar-xl', { id: 'profile-avatar' });
        $('profile-name').textContent = currentUser;
        $('profile-pic-btn').textContent = user.profilePic ? 'Foto ändern' : 'Foto hinzufügen';
        $('profile-pic-remove-btn').hidden = !user.profilePic;
        $('profile-paypal-input').value = user.paypal || '';
        $('profile-phone-input').value = user.phone || '';
        setProfileStatus('Änderungen werden automatisch gesichert.');
    }

    function setProfileStatus(text, isError = false) {
        const el = $('profile-status');
        el.textContent = text;
        el.style.color = isError ? 'var(--red-text)' : '';
    }

    // Jede Änderung im Profil wird sofort gesichert (wie in den iOS-Einstellungen)
    async function saveProfileFields(fields) {
        try {
            const result = await apiJson('/api/me/profile', 'PUT', fields);
            if (!result.success) { setProfileStatus(result.message || 'Fehler beim Speichern.', true); return; }
            await fetchPublicUsers();
            renderProfile();
            setProfileStatus('Gesichert.');
        } catch (err) { setProfileStatus('Fehler beim Speichern.', true); }
    }

    // Die Foto-Knöpfe sind <label for="profile-pic-input">: der Tipp öffnet die Auswahl selbst
    // (zuverlässig auch auf iOS), hier merken wir uns nur, wohin das Bild gehört
    function bindPicLabel(id, target) {
        const label = $(id);
        label.addEventListener('click', () => { picTarget = target; });
        label.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            picTarget = target;
            $('profile-pic-input').click();
        });
    }

    // Bild im Browser auf 256x256 verkleinern, damit es klein genug für den Server ist
    async function handleProfilePicChange(e) {
        const input = e.target;
        const file = input.files[0];
        if (!file) return;
        // Kein Vorab-Check auf file.type: iOS meldet bei manchen Fotos keinen oder einen falschen Typ.
        // Ob es ein lesbares Bild ist, entscheidet allein das Dekodieren unten.
        const target = picTarget;
        const label = $(target === 'welcome' ? 'welcome-pic-btn' : 'profile-pic-btn');
        const labelText = label.textContent;
        label.textContent = 'Foto wird geladen …';
        try {
            const source = await decodeImage(file);
            const dataUrl = squareThumbnail(source);
            if (source.close) source.close();
            if (target === 'welcome') {
                welcomePic = dataUrl;
                renderWelcomeAvatar();
            } else {
                await saveProfileFields({ profilePic: dataUrl });
            }
        } catch (err) {
            console.error('Profilbild:', err);
            const detail = `${err?.name || ''} ${err?.message || err || ''}`.trim();
            fetch(`${API_BASE}/api/client-error`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ context: 'profilePic', name: err?.name, message: err?.message || String(err), fileType: file.type, fileSize: file.size }),
            }).catch(() => {});
            alert(`Dieses Foto konnte nicht geladen werden. Bitte ein anderes probieren.\n\n(${detail})`);
        } finally {
            // Erst nach dem Lesen leeren: iOS Safari macht Fotos aus der Mediathek sonst unlesbar
            input.value = '';
            // Bei Erfolg setzt das Neuzeichnen den Text, sonst den alten wiederherstellen
            if (label.isConnected && label.textContent === 'Foto wird geladen …') label.textContent = labelText;
        }
    }

    // Erst der Browser selbst (JPG, PNG, WebP, in Safari auch HEIC); klappt das nicht und ist es ein
    // iPhone-Foto (HEIC), wird der Decoder nachgeladen (~3 MB, nur in diesem Fall)
    async function decodeImage(file) {
        try {
            return await decodeNative(file);
        } catch (nativeError) {
            try {
                const { isHeic, heicTo } = await import('./vendor/heic-to.js');
                if (!(await isHeic(file))) throw nativeError;
                return await heicTo({ blob: file, type: 'bitmap' });
            } catch (heicError) {
                if (heicError === nativeError) throw nativeError;
                throw new Error(`nativ: ${nativeError?.name || ''} ${nativeError?.message || nativeError} / heic: ${heicError?.name || ''} ${heicError?.message || heicError}`);
            }
        }
    }

    // createImageBitmap dekodiert direkt aus der Datei; iOS Safari scheitert bei großen Fotos
    // als data:-URL im <img> ("Bildformat nicht lesbar"), deshalb kein data:-Umweg mehr
    async function decodeNative(file) {
        if (window.createImageBitmap) {
            try { return await createImageBitmap(file); } catch (err) { /* Fallback über <img> */ }
        }
        return loadImageElement(file);
    }

    // Als blob:-URL laden (die Content-Security-Policy erlaubt dafür img-src blob:)
    function loadImageElement(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bildformat nicht lesbar')); };
            img.src = url;
        });
    }

    // Quadratisch zuschneiden (Mitte) und auf 256x256 verkleinern, damit es klein genug für den Server ist
    function squareThumbnail(source) {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const side = Math.min(source.width, source.height);
        canvas.getContext('2d').drawImage(source, (source.width - side) / 2, (source.height - side) / 2, side, side, 0, 0, size, size);
        return canvas.toDataURL('image/jpeg', 0.85);
    }

    // --- Helpers ---
    function esc(str) { const d = document.createElement('div'); d.textContent = String(str ?? ''); return d.innerHTML.replace(/"/g, '&quot;'); }

    // Farbe nach Platz in der WG; ehemalige Bewohner und Admin bleiben grau
    function avatarColor(name) {
        const index = WG_DATA.flatmates.indexOf(name);
        return index < 0 ? '' : `c${index % AVATAR_COLORS}`;
    }

    function initial(name) {
        return (Array.from(String(name || '?'))[0] || '?').toUpperCase();
    }

    // Avatar als HTML: Profilbild, falls vorhanden, sonst farbiger Kreis mit Anfangsbuchstabe
    function avatarHtml(name, sizeClass = '', { id = '', extraClass = '', badge = false, photo = true, src } = {}) {
        const pic = src !== undefined ? src : (photo ? publicUsers[name]?.profilePic : '');
        const content = pic ? `<img src="${esc(picUrl(pic))}" alt="">` : esc(initial(name));
        return `<span ${id ? `id="${id}" ` : ''}class="avatar ${sizeClass} ${avatarColor(name)} ${extraClass}" aria-hidden="true">${content}${badge ? ICON_BADGE : ''}</span>`;
    }

    // Profilbilder kommen als data:-URL vom Server; iOS Safari zeigt die im <img> nicht an,
    // deshalb einmal in eine blob:-URL umwandeln (je Bild zwischengespeichert)
    const picUrls = new Map();
    function picUrl(dataUrl) {
        if (!dataUrl.startsWith('data:')) return dataUrl;
        if (!picUrls.has(dataUrl)) {
            try {
                const [head, base64] = dataUrl.split(',');
                const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
                picUrls.set(dataUrl, URL.createObjectURL(new Blob([bytes], { type: head.slice(5).split(';')[0] })));
            } catch (err) {
                picUrls.set(dataUrl, dataUrl);
            }
        }
        return picUrls.get(dataUrl);
    }

    function fillAvatar(el, name) {
        const pic = publicUsers[name]?.profilePic;
        if (pic) {
            const img = document.createElement('img');
            img.src = picUrl(pic);
            img.alt = '';
            el.appendChild(img);
        } else {
            el.textContent = initial(name);
        }
    }

    function parseAmount(value) {
        return parseFloat(String(value).replace(/\s/g, '').replace(',', '.'));
    }

    function roundCents(value) {
        return Math.round(value * 100) / 100;
    }

    function balanceClass(value) {
        return value > 0.005 ? 'positive' : value < -0.005 ? 'negative' : '';
    }
});
