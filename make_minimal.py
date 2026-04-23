import os
import re

# --- 1. Rewrite style.css ---
css_content = """@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap');

:root {
    --bg: #FAFAFA;
    --surface: #FFFFFF;
    --text: #1A1A1A;
    --text-muted: #737373;
    --border: rgba(0, 0, 0, 0.08);
    --accent: #1A1A1A;
    --accent-hover: #333333;
    --error: #8b0000;
    --success: #1a4d2e;
}

@media (prefers-color-scheme: dark) {
    :root {
        --bg: #0A0A0A;
        --surface: #121212;
        --text: #F5F5F5;
        --text-muted: #888888;
        --border: rgba(255, 255, 255, 0.1);
        --accent: #F5F5F5;
        --accent-hover: #CCCCCC;
        --error: #ff6b6b;
        --success: #4d9b69;
    }
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

body {
    background-color: var(--bg);
    color: var(--text);
    font-family: 'Inter', sans-serif;
    font-weight: 300;
    line-height: 1.6;
    transition: background-color 0.5s ease, color 0.5s ease;
}

h1, h2, h3, h4, h5, h6, .serif {
    font-family: 'Playfair Display', serif;
    font-weight: 400;
    letter-spacing: 0.02em;
}

/* Base Components */
.glass-card {
    background: var(--surface);
    border: 1px solid var(--border);
    transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.glass-nav {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 1.5rem 3rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 100;
}

.view { display: none; opacity: 0; }
.view.active { display: block; opacity: 1; animation: fade 0.8s ease forwards; }
@keyframes fade { to { opacity: 1; } }

/* Buttons */
.btn {
    display: inline-block;
    padding: 0.85rem 2rem;
    font-family: 'Inter', sans-serif;
    font-weight: 400;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    cursor: pointer;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text);
    transition: all 0.4s ease;
}
.btn:hover { border-color: var(--text); }
.btn-primary { background: var(--accent); color: var(--bg); border-color: var(--accent); }
.btn-primary:hover { background: var(--accent-hover); color: var(--bg); border-color: var(--accent-hover); }
.btn-full { width: 100%; text-align: center; }

.btn-icon {
    background: none; border: none; color: var(--text);
    cursor: pointer; padding: 0.5rem; transition: opacity 0.3s;
    display: flex; align-items: center; justify-content: center;
}
.btn-icon:hover { opacity: 0.5; }

.btn-link, .btn-text {
    background: none; border: none; color: var(--text-muted);
    cursor: pointer; font-family: 'Inter', sans-serif; font-size: 0.8rem;
    text-transform: uppercase; letter-spacing: 0.05em; transition: color 0.3s;
}
.btn-text:hover, .btn-link:hover { color: var(--text); }

/* Inputs */
.input {
    width: 100%;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: 0.75rem 0;
    font-family: 'Inter', sans-serif;
    font-size: 1rem;
    color: var(--text);
    outline: none;
    transition: border-color 0.4s ease;
    border-radius: 0;
}
.input:focus { border-bottom-color: var(--text); }
select.input { appearance: none; -webkit-appearance: none; cursor: pointer; }

/* Login View */
#login-view.active { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
.login-card { max-width: 400px; width: 100%; text-align: center; border: none; padding: 0; background: transparent; }
.login-title { font-size: 3rem; margin-bottom: 1rem; font-style: italic; }
.login-subtitle { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 3rem; text-transform: uppercase; letter-spacing: 0.15em; }
.user-grid { display: grid; grid-template-columns: 1fr; gap: 1rem; }
.user-btn { padding: 1.25rem; font-size: 0.95rem; border: 1px solid var(--border); background: var(--surface); color: var(--text); cursor: pointer; transition: all 0.4s; letter-spacing: 0.05em; }
.user-btn:hover { border-color: var(--text); transform: translateY(-2px); }

/* Main Structure */
.page { max-width: 800px; margin: 0 auto; padding: 5rem 2rem; }
.page-hero-title { font-size: 4rem; margin-bottom: 4rem; font-style: italic; line-height: 1.1; }

.section-title { font-size: 2.2rem; margin: 5rem 0 2rem; font-style: italic; border-bottom: 1px solid var(--border); padding-bottom: 1.5rem; }
.subtitle { color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em; }
.error-text { color: var(--error); font-size: 0.8rem; margin-top: 1rem; letter-spacing: 0.05em; text-transform: uppercase; }

/* Menu Grid */
.menu-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; }
.menu-card { padding: 3rem; border: 1px solid var(--border); transition: all 0.5s; cursor: pointer; background: var(--surface); text-align: center; }
.menu-card:hover { border-color: var(--text); transform: translateY(-5px); }
.menu-card-title { font-size: 1.6rem; margin-bottom: 1rem; }
.menu-card-desc { font-size: 0.9rem; color: var(--text-muted); line-height: 1.6; }

/* Navbar */
.navbar-title { font-family: 'Playfair Display', serif; font-size: 1.3rem; letter-spacing: 0.05em; font-style: italic; }
.navbar-user { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); margin-right: 1.5rem; }
.navbar-right { display: flex; align-items: center; }

/* Putzplan specific */
.week-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4rem; }
.week-info { text-align: center; }
.week-info h2 { font-size: 2.5rem; margin-bottom: 0.5rem; }

.highlight-card { border: 1px solid var(--text); padding: 3rem; margin-bottom: 4rem; }
.highlight-card.is-pause { border-color: var(--border); opacity: 0.6; }
.task-content { margin-top: 2rem; }
.task-details h4 { font-size: 1.8rem; margin-bottom: 0.5rem; }

.all-tasks-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2rem; }
.task-card { padding: 2.5rem; border: 1px solid var(--border); }
.task-card.is-me { border-color: var(--text); box-shadow: inset 0 0 0 1px var(--text); }
.task-card-title { font-size: 1.4rem; margin-bottom: 0.5rem; font-family: 'Playfair Display', serif; }
.task-card.is-done { opacity: 0.4; }
.task-card-assignee { margin-top: 2rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); }

/* Finance & Shopping */
.input-group { display: flex; gap: 1.5rem; margin-bottom: 3rem; }
.shopping-item { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem 0; border-bottom: 1px solid var(--border); font-size: 1.1rem; }
.finance-item { display: flex; justify-content: space-between; align-items: center; padding: 2rem 0; border-bottom: 1px solid var(--border); flex-wrap: wrap; gap: 1.5rem; }
.item-main { flex: 1; }
.item-title { font-size: 1.25rem; font-family: 'Playfair Display', serif; margin-bottom: 0.4rem; }
.item-subtitle { font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.item-amount { font-family: 'Inter', sans-serif; font-weight: 300; font-size: 1.5rem; }
.balance-amount { font-size: 4.5rem; font-style: italic; margin: 1rem 0 3rem; font-family: 'Playfair Display', serif; font-weight: 400; }

.finance-card { text-align: center; margin-bottom: 3rem; }

/* Form Components */
.input-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); margin-bottom: 0.5rem; display: block; margin-top: 1.5rem; }

/* Custom Checkbox */
.checkbox-container { position: relative; padding-left: 2.2rem; cursor: pointer; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em; }
.checkbox-container input { position: absolute; opacity: 0; cursor: pointer; }
.checkmark { position: absolute; top: -3px; left: 0; height: 20px; width: 20px; border: 1px solid var(--border); transition: all 0.3s; border-radius: 0; }
.checkbox-container:hover input ~ .checkmark { border-color: var(--text); }
.checkbox-container input:checked ~ .checkmark { background: var(--text); border-color: var(--text); }
.checkmark:after { content: ""; position: absolute; display: none; left: 6px; top: 2px; width: 4px; height: 9px; border: solid var(--bg); border-width: 0 1px 1px 0; transform: rotate(45deg); }
.checkbox-container input:checked ~ .checkmark:after { display: block; }

/* Modals */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.4); z-index: 1000; display: none; align-items: center; justify-content: center; padding: 1rem; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.modal-overlay.active { display: flex; animation: fade 0.4s ease; }
.modal { width: 100%; max-width: 500px; background: var(--surface); border: 1px solid var(--border); padding: 3rem 2.5rem; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
.modal-header h3 { font-size: 1.8rem; font-style: italic; }
.modal-close { background: none; border: none; font-size: 2rem; font-weight: 300; line-height: 1; cursor: pointer; color: var(--text-muted); transition: color 0.3s; }
.modal-close:hover { color: var(--text); }
.split-row { display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; border-bottom: 1px solid var(--border); }
.split-row:last-child { border-bottom: none; }
.feedback-text { color: var(--success); margin-top: 1rem; text-align: center; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.1em; }

@media (max-width: 600px) {
    .page { padding: 3rem 1.5rem; }
    .page-hero-title { font-size: 2.8rem; }
    .menu-card { padding: 2rem; }
}
"""

with open('C:/Users/leona/Desktop/Projekt_Website/style.css', 'w', encoding='utf-8') as f:
    f.write(css_content)

# --- 2. Rewrite index.html (Clean HTML + SVGs) ---
svg_logout = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="square"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>'
svg_prev = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square"><polyline points="15 18 9 12 15 6"/></svg>'
svg_next = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square"><polyline points="9 18 15 12 9 6"/></svg>'

with open('C:/Users/leona/Desktop/Projekt_Website/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace all the emojis & blobs with extreme minimalism
html = html.replace('🚪', svg_logout)
html = html.replace('◀', svg_prev)
html = html.replace('▶', svg_next)

# Remove colored dots from menu
html = re.sub(r'<div class="menu-card-dot"[^>]*>.*?</div>', '', html)

# Remove task icon completely
html = re.sub(r'<div class="task-icon".*?>.*?</div>', '', html)

# Bump version to force cache refresh
html = re.sub(r'style\.css\?v=\d+', 'style.css?v=25', html)

with open('C:/Users/leona/Desktop/Projekt_Website/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

# --- 3. Rewrite data.js (Remove icons entirely) ---
with open('C:/Users/leona/Desktop/Projekt_Website/data.js', 'r', encoding='utf-8') as f:
    data = f.read()

data = re.sub(r'icon: ".*?"', 'icon: ""', data)

with open('C:/Users/leona/Desktop/Projekt_Website/data.js', 'w', encoding='utf-8') as f:
    f.write(data)

# --- 4. Rewrite app.js (Remove visual emojis, replace with text / minimal SVG) ---
with open('C:/Users/leona/Desktop/Projekt_Website/app.js', 'r', encoding='utf-8') as f:
    app = f.read()

svg_check = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><polyline points="20 6 9 17 4 12"/></svg>'

app = app.replace('✅ Erledigt', 'Erledigt')
app = app.replace('⏳ Offen', 'Offen')
app = app.replace('✏️ Edit', 'Bearbeiten')
app = app.replace('🗑️ Löschen', 'Löschen')
app = app.replace('<button class="btn-icon">✅</button>', f'<button class="btn-icon">{svg_check}</button>')

# Remove dynamic icon injection to keep it clean
app = app.replace('myTaskIcon.textContent = myAsgn.role.icon;', '')
app = re.sub(r'<span class="task-card-icon">\$\{asgn\.role\.icon\}</span>', '', app)

with open('C:/Users/leona/Desktop/Projekt_Website/app.js', 'w', encoding='utf-8') as f:
    f.write(app)

print("Minimal Luxury Overwrite Complete.")
