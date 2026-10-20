document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = window.location.origin;
    console.log("App started, API_BASE set to:", API_BASE);

    // State
    let currentUser = localStorage.getItem('wg_user');
    let authToken = localStorage.getItem('wg_token');
    let lastActivity = Date.now();
    let currentWeekOffset = 0;
    let selectedUserForLogin = null;
    let currentWeekData = null;
    let publicUsers = {};

    // --- DOM Elements ---
    
    // Views
    const loginView = document.getElementById('login-view');
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
    const myTaskIcon = document.getElementById('my-task-icon');
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
    const adminPasswordCloseBtn = document.getElementById('admin-password-close-btn');

    // Modals
    const modalOverlay = document.getElementById('modal-overlay');
    const expenseModal = document.getElementById('expense-modal');
    const expenseCloseBtn = document.getElementById('expense-close-btn');
    const profileModal = document.getElementById('profile-modal');
    const profileCloseBtn = document.getElementById('profile-close-btn');

    // --- Init ---
    init();

    function init() {
        renderLogin();
        if (currentUser) {
            fetchPublicUsers().then(() => showMenu()).catch(() => {
                alert("Server auf Port 3000 nicht erreichbar!");
            });
        } else {
            showLogin();
        }
        setupEventListeners();
    }

    async function apiFetch(url, options = {}) {
        options.headers = options.headers || {};
        if (authToken) {
            options.headers['Authorization'] = authToken;
        }
        
        const res = await fetch(url, options);
        
        if (res.status === 401) {
            console.warn("Sitzung abgelaufen oder ungültig.");
            logout();
            throw new Error("Sitzung abgelaufen");
        }
        
        return res;
    }

    async function fetchPublicUsers() {
        try {
            const res = await apiFetch(`${API_BASE}/api/users/public`);
            if (!res.ok) throw new Error();
            const result = await res.json();
            if (result.success) publicUsers = result.data;
        } catch (err) {
            console.error("Fetch error:", err);
            throw err;
        }
    }

    function setupEventListeners() {
        loginSubmitBtn.addEventListener('click', attemptLogin);
        passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') attemptLogin(); });
        loginBackBtn.addEventListener('click', () => {
            passwordSection.style.display = 'none';
            userGrid.style.display = 'grid';
            selectedUserForLogin = null;
        });

        const logouts = [menuLogoutBtn, document.getElementById('putzplan-logout-btn'), document.getElementById('shopping-logout-btn'), document.getElementById('finance-logout-btn'), adminLogoutBtn];
        logouts.forEach(btn => btn?.addEventListener('click', logout));

        menuPutzplanBtn.addEventListener('click', showPutzplan);
        menuShoppingBtn.addEventListener('click', showShopping);
        menuFinanceBtn.addEventListener('click', showFinance);
        menuProfileBtn.addEventListener('click', showProfile);
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
        expenseCloseBtn.addEventListener('click', closeModal);
        profileCloseBtn.addEventListener('click', closeModal);

        document.getElementById('expense-split-type').addEventListener('change', renderExpenseSplits);
        document.getElementById('expense-amount').addEventListener('input', () => {
            if (document.getElementById('expense-split-type').value === 'equal') renderExpenseSplits();
        });
        document.getElementById('expense-save-btn').addEventListener('click', saveExpense);
        document.getElementById('profile-save-btn').addEventListener('click', saveProfile);
        document.getElementById('profile-pic-input').addEventListener('change', handleProfilePicChange);

        adminPasswordCloseBtn.addEventListener('click', closeModal);
        document.getElementById('admin-password-save-btn').addEventListener('click', saveAdminPassword);

        // Security: Aktivität tracken
        ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
            window.addEventListener(evt, () => { lastActivity = Date.now(); });
        });
        
        setInterval(checkSecurityTimeout, 30000); // Alle 30 Sek prüfen
    }

    function checkSecurityTimeout() {
        if (!currentUser) return;
        
        const now = Date.now();
        const thirtyMinutes = 30 * 60 * 1000;
        
        if (now - lastActivity > thirtyMinutes) {
            console.log("Logout wegen Inaktivität");
            logout();
            alert("Du wurdest wegen Inaktivität ausgeloggt.");
        }
    }

    // --- Auth Logic ---
    function logout() { 
        localStorage.removeItem('wg_user'); 
        localStorage.removeItem('wg_token');
        currentUser = null; 
        authToken = null;
        showLogin(); 
    }
    async function attemptLogin() {
        const password = passwordInput.value;
        if (!password || !selectedUserForLogin) return;
        try {
            console.log("Attempting login for:", selectedUserForLogin);
            const res = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: selectedUserForLogin, password })
            });
            const result = await res.json();
            if (result.success) {
                currentUser = selectedUserForLogin;
                authToken = result.token;
                localStorage.setItem('wg_user', currentUser);
                localStorage.setItem('wg_token', authToken);
                lastActivity = Date.now();
                passwordInput.value = '';
                loginError.style.display = 'none';
                fetchPublicUsers().then(() => showMenu());
            } else {
                loginError.textContent = result.message || 'Falsches Passwort';
                loginError.style.display = 'block';
            }
        } catch (err) {
            console.error("Login Error:", err);
            alert("Login fehlgeschlagen. Ist der Server auf Port 3000 aktiv? (CORS/Netzwerkfehler)");
        }
    }
    function renderLogin() {
        userGrid.innerHTML = '';
        if (!WG_DATA || !WG_DATA.flatmates) return;
        WG_DATA.flatmates.concat(["Admin"]).forEach(name => {
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

    // --- View Switching ---
    function hideAllViews() { document.querySelectorAll('.view').forEach(v => v.classList.remove('active')); }
    function showMenu() { 
        hideAllViews(); 
        menuView.classList.add('active'); 
        menuUserName.textContent = currentUser; 
        
        const isAdmin = (currentUser === 'Admin');
        
        // Admin sieht NUR den Admin-Button, andere sehen ALLES AUẞER den Admin-Button
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
        renderAdminUserList();
    }

    function renderAdminUserList() {
        adminUserList.innerHTML = '';
        WG_DATA.flatmates.forEach(name => {
            const div = document.createElement('div');
            div.className = 'finance-item glass-card';
            div.innerHTML = `<div class="item-main"><div><div class="item-title">${name}</div><div class="item-subtitle">Bewohner</div></div><button class="btn-text btn-sm change-pw-btn" data-user="${name}">PW ändern</button></div>`;
            div.querySelector('.change-pw-btn').addEventListener('click', () => openAdminPasswordModal(name));
            adminUserList.appendChild(div);
        });
    }

    function openAdminPasswordModal(name) {
        document.getElementById('admin-target-user').value = name;
        document.getElementById('admin-target-name').textContent = name;
        document.getElementById('admin-new-password').value = '';
        document.getElementById('admin-password-feedback').textContent = '';
        openModal(adminPasswordModal);
    }

    async function saveAdminPassword() {
        const username = document.getElementById('admin-target-user').value;
        const newPassword = document.getElementById('admin-new-password').value.trim();
        if (!newPassword) return alert('Bitte Passwort eingeben.');
        try {
            const res = await apiFetch(`${API_BASE}/api/users/${username}/password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword })
            });
            const result = await res.json();
            if (result.success) {
                document.getElementById('admin-password-feedback').textContent = 'Passwort geändert!';
                setTimeout(closeModal, 1500);
            }
        } catch (err) { alert('Fehler beim Speichern.'); }
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
            const res = await apiFetch(`${API_BASE}/api/tasks/${currentWeekData.weekKey}`);
            const result = await res.json();
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
        }
        allTasksGrid.innerHTML = '';
        currentWeekData.assignments.forEach(asgn => {
            const isMe = asgn.assignee === currentUser;
            const isDone = !!statuses[asgn.assignee];
            const card = document.createElement('div');
            card.className = `glass-card task-card ${isMe ? 'is-me' : ''} ${isDone ? 'is-done' : ''}`;
            card.innerHTML = `<div class="task-card-header"><span class="task-card-title">${asgn.role.title}</span></div><div style="margin-top:10px;font-size:0.9em;">${isDone ? '<span style="color:var(--success)">Erledigt</span>' : '<span style="color:var(--text-muted)">Offen</span>'}</div><div class="task-card-assignee">${isMe ? 'Du' : asgn.assignee}</div>`;
            allTasksGrid.appendChild(card);
        });
    }

    async function handleTaskToggle(e) {
        const isCompleted = e.target.checked;
        try {
            await apiFetch(`${API_BASE}/api/tasks/${currentWeekData.weekKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUser, completed: isCompleted })
            });
            updatePutzplan();
        } catch (err) { e.target.checked = !isCompleted; }
    }

    // --- Shopping Logic ---
    async function loadShoppingList() {
        try {
            const res = await apiFetch(`${API_BASE}/api/shopping`);
            const result = await res.json();
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
            await apiFetch(`${API_BASE}/api/shopping`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
            shoppingInput.value = ''; loadShoppingList();
        } catch (err) {}
    }
    async function deleteShoppingItem(id) { try { await apiFetch(`${API_BASE}/api/shopping/${id}`, { method: 'DELETE' }); loadShoppingList(); } catch (err) {} }

    // --- Finance Logic ---
    async function loadFinances() {
        try {
            const res = await apiFetch(`${API_BASE}/api/expenses`);
            const result = await res.json();
            if (result.success) renderFinances(result.data);
        } catch (err) {}
    }
    function renderFinances(expenses) {
        const balances = {};
        WG_DATA.flatmates.forEach(name => balances[name] = 0);
        expenses.forEach(exp => {
            balances[exp.paidBy] += exp.amount;
            for (const [user, share] of Object.entries(exp.splits)) { balances[user] -= share; }
        });
        const myBalance = balances[currentUser] || 0;
        financeTotalBalance.textContent = `${myBalance.toFixed(2)} €`;
        financeTotalBalance.style.color = myBalance >= 0 ? 'var(--success)' : 'var(--danger)';
        renderDebts(balances);
        financeExpensesList.innerHTML = '';
        expenses.slice().reverse().forEach(exp => {
            const div = document.createElement('div');
            div.className = 'finance-item glass-card';
            const date = new Date(exp.date).toLocaleDateString('de-DE');
            let actionsHtml = '';
            // Admin darf ALLES löschen, Bewohner eigene ODER wenn sie der Zahler waren (Fallback für alte Daten)
            const isOwner = (exp.addedBy === currentUser) || (!exp.addedBy && exp.paidBy === currentUser);
            if (isOwner || currentUser === 'Admin') {
                actionsHtml = `<div class="item-actions" style="width:100%; display:flex; gap:10px; margin-top:10px; border-top:1px solid var(--border); padding-top:10px;">
                    <button class="btn-text btn-sm edit-btn" data-id="${exp.id}" style="color:var(--accent);">Bearbeiten</button>
                    <button class="btn-text btn-sm delete-btn" data-id="${exp.id}" style="color:var(--error);">Löschen</button>
                </div>`;
            }
            div.innerHTML = `<div class="item-main"><div><div class="item-title">${esc(exp.description)}</div><div class="item-subtitle">${date} • Bezahlt von ${exp.paidBy}</div></div><div class="item-amount">${exp.amount.toFixed(2)} €</div></div>${actionsHtml}`;
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
                    const text = isCreditor ? `${other} schuldet dir` : `Du schuldest ${other}`;
                    let settleBtn = '';
                    if (!isCreditor) {
                        const paypal = publicUsers[other]?.paypal;
                        const paypalLink = paypal ? `https://paypal.me/${paypal.replace(/^(https?:\/\/)?(www\.)?paypal\.me\//i, '')}/${amount.toFixed(2)}` : null;
                        settleBtn = `<div style="margin-top:10px;display:flex;gap:10px;width:100%;">
                            <button class="btn btn-primary btn-sm settle-btn" style="flex:1;">Als bezahlt markieren</button>
                            ${paypalLink ? `<a href="${paypalLink}" target="_blank" class="btn-paypal" style="flex:1;">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106z"/></svg>
                                PayPal
                            </a>` : ''}
                        </div>`;
                    }
                    row.innerHTML = `<div class="item-main"><div class="item-title">${text}</div><div class="item-amount">${amount.toFixed(2)} €</div></div>${settleBtn}`;
                    const btn = row.querySelector('.settle-btn');
                    if (btn) btn.addEventListener('click', () => settleDebt(other, currentUser, amount));
                    financeDebtsList.appendChild(row);
                }
                d.bal -= amount; c.bal -= amount;
            });
        });
    }
    async function settleDebt(to, from, amount) {
        if (!confirm(`${amount.toFixed(2)} € an ${to} als bezahlt markieren?`)) return;
        try {
            await apiFetch(`${API_BASE}/api/expenses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: `Schuldenbegleichung an ${to}`, amount: amount, paidBy: from, splits: { [to]: amount }, addedBy: currentUser }) });
            loadFinances();
        } catch (err) {}
    }
    async function deleteExpense(id) {
        if (!confirm('Diese Ausgabe wirklich löschen?')) return;
        try {
            await apiFetch(`${API_BASE}/api/expenses/${id}`, { method: 'DELETE' });
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
        payerSelect.innerHTML = WG_DATA.flatmates.map(name => `<option value="${name}" ${name === currentUser ? 'selected' : ''}>${name}</option>`).join('');
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
            if (type === 'equal') { const share = (amount / WG_DATA.flatmates.length).toFixed(2); div.innerHTML = `<span>${name}</span><span>${share} €</span>`; }
            else { div.innerHTML = `<span>${name}</span><input type="number" class="split-input input" data-user="${name}" placeholder="0.00" step="0.01">`; }
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
        const method = id ? 'PUT' : 'POST'; const url = id ? `${API_BASE}/api/expenses/${id}` : `${API_BASE}/api/expenses`;
        try {
            const res = await apiFetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: desc, amount, paidBy: payer, splits, addedBy: currentUser }) });
            const result = await res.json(); if (result.success) { closeModal(); loadFinances(); }
        } catch (err) { alert('Fehler beim Speichern.'); }
    }

    // --- Profile Logic ---
    function showProfile() {
        const user = publicUsers[currentUser] || {};
        document.getElementById('profile-paypal-input').value = user.paypal || '';
        document.getElementById('profile-phone-input').value = user.phone || '';
        
        const preview = document.getElementById('profile-pic-preview');
        const placeholder = document.getElementById('profile-pic-placeholder');
        if (user.profilePic) {
            preview.src = user.profilePic;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
        } else {
            preview.style.display = 'none';
            placeholder.style.display = 'flex';
        }
        
        document.getElementById('profile-feedback').textContent = ''; 
        openModal(profileModal);
    }

    function handleProfilePicChange(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const preview = document.getElementById('profile-pic-preview');
            const placeholder = document.getElementById('profile-pic-placeholder');
            preview.src = event.target.result;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    async function saveProfile() {
        const paypal = document.getElementById('profile-paypal-input').value.trim();
        const phone = document.getElementById('profile-phone-input').value.trim();
        const profilePic = document.getElementById('profile-pic-preview').style.display === 'block' 
            ? document.getElementById('profile-pic-preview').src 
            : '';

        try {
            const res = await apiFetch(`${API_BASE}/api/users/${currentUser}/profile`, { 
                method: 'PUT', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ paypal, phone, profilePic }) 
            });
            const result = await res.json(); 
            if (result.success) { 
                document.getElementById('profile-feedback').textContent = 'Profil gespeichert!'; 
                fetchPublicUsers(); 
                setTimeout(closeModal, 1000); 
            }
        } catch (err) {}
    }

    // --- Helpers ---
    function esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
});
