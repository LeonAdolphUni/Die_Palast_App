import os

css_content = """
:root {
    /* Light Mode (Default) iOS Style */
    --bg-color: #f2f2f7;
    --surface-color: #ffffff;
    --text-main: #000000;
    --text-muted: #8e8e93;
    --primary: #007aff;
    --primary-hover: #0056b3;
    --success: #34c759;
    --danger: #ff3b30;
    --warning: #ff9f0a;
    --border-color: rgba(60, 60, 67, 0.1);
    --nav-bg: rgba(255, 255, 255, 0.7);
    --card-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
    --radius: 18px;
    --radius-sm: 10px;
    --card-active: #e5e5ea;
}

@media (prefers-color-scheme: dark) {
    :root {
        /* Dark Mode iOS Style */
        --bg-color: #000000;
        --surface-color: #1c1c1e;
        --text-main: #ffffff;
        --text-muted: #ebebf5;
        --border-color: rgba(84, 84, 88, 0.4);
        --nav-bg: rgba(28, 28, 30, 0.7);
        --card-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        --card-active: #2c2c2e;
    }
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
}

body {
    background-color: var(--bg-color);
    color: var(--text-main);
    min-height: 100vh;
    line-height: 1.4;
    transition: background-color 0.3s ease, color 0.3s ease;
}

/* Glass & Surfaces */
.glass-card {
    background: var(--surface-color);
    border: 0.5px solid var(--border-color);
    border-radius: var(--radius);
    box-shadow: var(--card-shadow);
    transition: background-color 0.3s ease, border-color 0.3s ease, transform 0.2s ease;
}

.glass-nav {
    background: var(--nav-bg);
    backdrop-filter: blur(25px) saturate(180%);
    -webkit-backdrop-filter: blur(25px) saturate(180%);
    border-bottom: 0.5px solid var(--border-color);
    padding: 1.25rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 100;
}

/* Views */
.view {
    display: none;
    opacity: 0;
}
.view.active {
    display: block;
    opacity: 1;
    animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

/* Login View */
#login-view.active {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
}
.login-card {
    padding: 3rem 2rem;
    width: 100%;
    max-width: 420px;
    text-align: center;
}
.login-title {
    font-size: 2.75rem;
    font-weight: 800;
    letter-spacing: -0.04em;
    margin-bottom: 0.5rem;
}
.login-subtitle {
    color: var(--text-muted);
    font-size: 1.1rem;
    margin-bottom: 2.5rem;
}
.user-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.25rem;
}
.user-btn {
    background: var(--surface-color);
    border: 0.5px solid var(--border-color);
    color: var(--text-main);
    padding: 1.5rem 1rem;
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 1.1rem;
    font-weight: 600;
    transition: all 0.3s ease;
    box-shadow: var(--card-shadow);
}
.user-btn:hover {
    transform: scale(1.03);
}
.user-btn:active {
    transform: scale(0.97);
}

/* Navbar */
.navbar-title {
    font-size: 1.2rem;
    font-weight: 700;
    letter-spacing: -0.02em;
}
.navbar-user {
    font-weight: 500;
    color: var(--text-muted);
    margin-right: 0.5rem;
}
.navbar-right {
    display: flex;
    align-items: center;
}

/* Main Menu */
.page {
    max-width: 800px;
    margin: 0 auto;
    padding: 2.5rem 1.5rem;
}
.page-hero-title {
    font-size: 2.5rem;
    font-weight: 800;
    letter-spacing: -0.04em;
    margin-bottom: 2.5rem;
}
.menu-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
}
.menu-card {
    padding: 1.5rem;
    text-align: left;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border: none; /* Make it a bit flatter */
}
.menu-card:hover {
    transform: translateY(-3px);
}
.menu-card-dot {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    margin-bottom: 0.5rem;
}
.menu-card-title {
    font-size: 1.3rem;
    font-weight: 700;
    letter-spacing: -0.02em;
}
.menu-card-desc {
    color: var(--text-muted);
    font-size: 0.95rem;
}

/* Putzplan */
.week-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding: 0.5rem;
}
.week-info { text-align: center; }
.week-info h2 { font-size: 1.4rem; font-weight: 700; }
.subtitle { color: var(--text-muted); font-size: 0.95rem; }

.highlight-card {
    padding: 2rem;
    margin-bottom: 2.5rem;
    border: 2px solid var(--primary);
}
.highlight-card.is-pause {
    border-color: var(--border-color);
}
.task-content {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    margin-top: 1rem;
}
.task-icon {
    font-size: 3rem;
}
.task-details h4 { font-size: 1.3rem; margin-bottom: 0.3rem;}
.task-details p { color: var(--text-muted); font-size: 0.95rem; }

.section-title {
    font-size: 1.4rem;
    font-weight: 700;
    margin-bottom: 1rem;
    margin-top: 2rem;
}
.all-tasks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1.25rem;
}
.task-card {
    padding: 1.5rem;
}
.task-card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}
.task-card-icon { font-size: 1.5rem; }
.task-card-title { font-weight: 600; font-size: 1.1rem; }
.task-card-assignee {
    margin-top: 1rem;
    padding: 0.4rem;
    background: var(--card-active);
    border-radius: var(--radius-sm);
    font-weight: 600;
    text-align: center;
    color: var(--text-main);
}
.task-card.is-me { border: 2px solid var(--primary); }
.task-card.is-me .task-card-assignee { background: var(--primary); color: white; }
.task-card.is-done { opacity: 0.5; }

/* Shopping */
.input-group {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
}
.shopping-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
.shopping-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
}

/* Finance */
.finance-card {
    padding: 2rem;
    text-align: center;
    margin-bottom: 1.5rem;
}
.balance-amount {
    font-size: 3.5rem;
    font-weight: 800;
    letter-spacing: -0.04em;
    margin-top: 0.5rem;
}
.finance-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
.finance-item {
    padding: 1.25rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
}
.item-main { flex: 1; display: flex; justify-content: space-between; align-items: center; }
.item-title { font-weight: 600; font-size: 1.1rem; }
.item-subtitle { color: var(--text-muted); font-size: 0.9rem; margin-top: 0.2rem;}
.item-amount { font-weight: 700; font-size: 1.2rem; }
.item-actions { display: flex; gap: 0.5rem; }

/* Buttons */
.btn {
    padding: 0.8rem 1.5rem;
    border-radius: var(--radius-sm);
    font-weight: 600;
    font-size: 1rem;
    border: none;
    cursor: pointer;
    transition: transform 0.2s ease, opacity 0.2s ease;
}
.btn-primary { background: var(--primary); color: #ffffff; }
.btn-primary:active { transform: scale(0.97); }
.btn-secondary { background: var(--card-active); color: var(--text-main); }
.btn-secondary:active { transform: scale(0.97); }
.btn-full { width: 100%; display: block; padding: 1rem;}
.btn-icon {
    background: none; border: none; color: var(--primary); font-size: 1.5rem; padding: 0.5rem; cursor: pointer; line-height: 1; border-radius: 50%;
}
.btn-icon:hover { background: var(--card-active); }
.btn-text { background: none; border: none; color: var(--primary); font-weight: 500; cursor: pointer; font-size: 1rem; }
.btn-sm { padding: 0.4rem 0.8rem; font-size: 0.9rem; border-radius: 6px;}

/* Inputs */
.input {
    width: 100%;
    background: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    padding: 0.8rem 1rem;
    font-size: 1rem;
    color: var(--text-main);
    outline: none;
    transition: border-color 0.2s ease;
}
.input:focus { border-color: var(--primary); border-width: 2px; padding: calc(0.8rem - 1px) calc(1rem - 1px); }

/* Checkbox (iOS Style Override) */
.checkbox-container {
    display: flex;
    align-items: center;
    position: relative;
    padding-left: 36px;
    cursor: pointer;
    font-weight: 600;
    color: var(--text-main);
}
.checkbox-container input { position: absolute; opacity: 0; cursor: pointer; height: 0; width: 0; }
.checkmark {
    position: absolute; left: 0; height: 26px; width: 26px; border-radius: 50%; border: 2px solid var(--border-color);
    background-color: var(--surface-color); transition: all 0.2s;
}
.checkbox-container input:checked ~ .checkmark { background-color: var(--primary); border-color: var(--primary); }
.checkmark:after {
    content: ""; position: absolute; display: none; left: 8px; top: 4px; width: 5px; height: 10px;
    border: solid white; border-width: 0 2px 2px 0; transform: rotate(45deg);
}
.checkbox-container input:checked ~ .checkmark:after { display: block; }

/* Modals */
.modal-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);
    z-index: 1000; display: none; align-items: center; justify-content: center; padding: 1rem;
}
.modal-overlay.active { display: flex; animation: fadeIn 0.2s; }
.modal {
    width: 100%; max-width: 400px;
    background: var(--bg-color); /* iOS modals use bg-color often, surface for cards */
    border-radius: var(--radius);
    overflow: hidden; display: none;
    box-shadow: 0 10px 30px rgba(0,0,0,0.15);
}
.modal.active { display: block; animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
@keyframes scaleUp { from { opacity:0; transform: scale(0.95); } to { opacity:1; transform: scale(1); } }

.modal-header { padding: 1.25rem 1.5rem; background: var(--surface-color); border-bottom: 0.5px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { font-size: 1.2rem; font-weight: 700; }
.modal-close { background: var(--card-active); border: none; color: var(--text-main); font-size: 1.5rem; width: 32px; height: 32px; border-radius: 16px; cursor: pointer; display:flex; align-items:center; justify-content:center; }
.modal-body { padding: 1.5rem; max-height: 80vh; overflow-y: auto; background: var(--surface-color);}
.input-label { display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin-bottom: 0.5rem; margin-top: 1rem; text-transform: uppercase; letter-spacing: 0.05em; }

.split-row { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 0.5px solid var(--border-color); }
.split-row:last-child { border-bottom: none; }

.error-text { color: var(--danger); margin-top: 1rem; font-weight: 600; font-size: 0.9rem;}
.feedback-text { color: var(--success); margin-top: 1rem; text-align: center; font-weight: 600; font-size: 0.9rem;}

@media (max-width: 600px) {
    .login-title { font-size: 2.25rem; }
    .page-hero-title { font-size: 2rem; }
    .menu-grid { grid-template-columns: 1fr; }
}

/* Helper */
.btn-link { background: none; border: none; color: var(--primary); font-weight: 500; font-size: 1rem; width: 100%; padding: 0.5rem; cursor: pointer;}
.empty-state { text-align: center; color: var(--text-muted); margin-top: 2rem; font-weight: 500;}

"""

with open("C:/Users/leona/Desktop/Projekt_Website/style.css", "w", encoding="utf-8") as f:
    f.write(css_content)

print("CSS updated successfully!")
