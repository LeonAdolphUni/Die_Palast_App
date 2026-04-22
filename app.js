document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = '';

    // State
    let currentUser = localStorage.getItem('wg_user');
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
            fetchPublicUsers().then(() => showMenu());
        } else {
            showLogin();
        }
        setupEventListeners();
    }

    async function fetchPublicUsers() {
        try {
            const res = await fetch(`${API_BASE}/api/users/public`);
            const result = await res.json();
            if (result.success) publicUsers = result.data;
        } catch (err) {}
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
    }

    // --- Auth Logic ---
    function logout() { localStorage.removeItem('wg_user'); currentUser = null; showLogin(); }
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
                currentUser = selectedUserForLogin;
                localStorage.setItem('wg_user', currentUser);
                passwordInput.value = '';
                loginError.style.display = 'none';
                fetchPublicUsers().then(() => showMenu());
            } else {
                loginError.textContent = result.message || 'Falsches Passwort';
                loginError.style.display = 'block';
            }
        } catch (err) {}
    }
    function renderLogin() {
        userGrid.innerHTML = '';
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
        menuAdminBtn.style.display = (currentUser === 'Admin') ? 'flex' : 'none';
    }
    function showLogin() { hideAllViews(); loginView.classList.add('active'); userGrid.style.display = 'grid'; passwordSection.style.display = 'none'; }
    function showPutzplan() { hideAllViews(); putzplanView.classList.add('active'); currentWeekOffset = 0; updatePutzplan(); }
    function showShopping() { hideAllViews(); shoppingView.classList.add('active'); loadShoppingList(); }
    function showFinance() { hideAllViews(); financeView.classList.add('active'); loadFinances(); }
    function showAdmin() { hideAllViews(); adminView.classList.add('active'); }

    // --- Putzplan Logic ---
    function getWeekData(offsetOffset) {
        const startDate = new Date(WG_DATA.startDate);
        const now = new Date();
        const currentMonday = new Date(now);
        const day = currentMonday.getDay();
        const diff = currentMonday.getDate() - day + (day === 0 ? -6 : 1);
        currentMonday.setDate(diff);
        currentMonday.setHours(0, 0, 0, 0);
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
        let title = "Diese Woche";
        if (offsetOffset === -1) title = "Letzte Woche";
        else if (offsetOffset === 1) title = "Nächste Woche";
        else if (offsetOffset !== 0) title = `Woche ${targetWeekIndex + 1}`;
        return { title, dateString: `${fmt(targetMonday)} - ${fmt(targetSunday)}`, weekKey: `${targetMonday.getFullYear()}-W${String(targetWeekIndex).padStart(2, '0')}`, assignments };
    }

    async function updatePutzplan() {
        currentWeekData = getWeekData(currentWeekOffset);
        weekTitle.textContent = currentWeekData.title;
        weekDate.textContent = currentWeekData.dateString;
        let statuses = {};
        try {
            const res = await fetch(`${API_BASE}/api/tasks/${currentWeekData.weekKey}`);
            const result = await res.json();
            if (result.success) statuses = result.data;
        } catch (err) {}
        const myAsgn = currentWeekData.assignments.find(a => a.assignee === currentUser);
        if (myAsgn) {
            myTaskIcon.textContent = myAsgn.role.icon;
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
            card.innerHTML = `<div class="task-card-header"><span class="task-card-icon">${asgn.role.icon}</span><span class="task-card-title">${asgn.role.title}</span></div><div style="margin-top:10px;font-size:0.9em;">${isDone ? '<span style="color:var(--success)">✅ Erledigt</span>' : '<span style="color:var(--text-muted)">⏳ Offen</span>'}</div><div class="task-card-assignee">${isMe ? 'Du' : asgn.assignee}</div>`;
            allTasksGrid.appendChild(card);
        });
    }

    async function handleTaskToggle(e) {
        const isCompleted = e.target.checked;
        try {
            await fetch(`${API_BASE}/api/tasks/${currentWeekData.weekKey}`, {
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
            const res = await fetch(`${API_BASE}/api/shopping`);
            const result = await res.json();
            if (result.success) renderShoppingList(result.data);
        } catch (err) {}
    }
    function renderShoppingList(items) {
        shoppingList.innerHTML = '';
        shoppingEmpty.style.display = items.length === 0 ? 'block' : 'none';
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'shopping-item glass-card';
            div.innerHTML = `<span>${esc(item.text)}</span><button class="btn-icon">✅</button>`;
            div.querySelector('button').addEventListener('click', () => deleteShoppingItem(item.id));
            shoppingList.appendChild(div);
        });
    }
    async function addShoppingItem() {
        const text = shoppingInput.value.trim();
        if (!text) return;
        try {
            await fetch(`${API_BASE}/api/shopping`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
            shoppingInput.value = ''; loadShoppingList();
        } catch (err) {}
    }
    async function deleteShoppingItem(id) { try { await fetch(`${API_BASE}/api/shopping/${id}`, { method: 'DELETE' }); loadShoppingList(); } catch (err) {} }

    // --- Finance Logic ---
    async function loadFinances() {
        try {
            const res = await fetch(`${API_BASE}/api/expenses`);
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
            if (exp.addedBy === currentUser) {
                actionsHtml = `<div class="item-actions"><button class="btn-text btn-sm edit-btn" data-id="${exp.id}">✏️ Edit</button><button class="btn-text btn-sm delete-btn" data-id="${exp.id}" style="color:var(--danger);">🗑️ Löschen</button></div>`;
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
                        settleBtn = `<div style="margin-top:10px;display:flex;gap:10px;"><button class="btn btn-primary btn-sm settle-btn">Begleichen</button>${paypalLink ? `<a href="${paypalLink}" target="_blank" class="btn btn-secondary btn-sm" style="text-decoration:none;">PayPal</a>` : ''}</div>`;
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
            await fetch(`${API_BASE}/api/expenses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: `Schuldenbegleichung an ${to}`, amount: amount, paidBy: from, splits: { [to]: amount }, addedBy: currentUser }) });
            loadFinances();
        } catch (err) {}
    }
    async function deleteExpense(id) {
        if (!confirm('Diese Ausgabe wirklich löschen?')) return;
        try {
            await fetch(`${API_BASE}/api/expenses/${id}`, { method: 'DELETE' });
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
            const res = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: desc, amount, paidBy: payer, splits, addedBy: currentUser }) });
            const result = await res.json(); if (result.success) { closeModal(); loadFinances(); }
        } catch (err) { alert('Fehler beim Speichern.'); }
    }

    // --- Profile Logic ---
    function showProfile() {
        document.getElementById('profile-paypal-input').value = publicUsers[currentUser]?.paypal || '';
        document.getElementById('profile-feedback').textContent = ''; openModal(profileModal);
    }
    async function saveProfile() {
        const paypal = document.getElementById('profile-paypal-input').value.trim();
        try {
            const res = await fetch(`${API_BASE}/api/users/${currentUser}/paypal`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paypal }) });
            const result = await res.json(); if (result.success) { document.getElementById('profile-feedback').textContent = 'Gespeichert!'; fetchPublicUsers(); setTimeout(closeModal, 1000); }
        } catch (err) {}
    }

    // --- Helpers ---
    function esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
});
