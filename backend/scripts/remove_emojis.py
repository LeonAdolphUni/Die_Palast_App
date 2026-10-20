import os
import re

# Read index.html
with open('c:/Users/leona/Desktop/Projekt_Website/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Emojis in index.html to remove/replace:
# 🚪 -> Lucide/Heroicon icon string (Log out)
ico_logout = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>'
# ◀ -> Lucide/Heroicon Chevron left
ico_prev = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>'
# ▶ -> Lucide/Heroicon Chevron right
ico_next = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>'
# 🧹 -> Lucide Sparkles (Putzplan view my-task-icon fallback, handled in JS anyway, but changing default)
ico_sparkles = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path></svg>'

content = content.replace('🚪', ico_logout)
content = content.replace('◀', ico_prev)
content = content.replace('▶', ico_next)
content = content.replace('🧹', ico_sparkles)
content = content.replace('v=14', 'v=15')

with open('c:/Users/leona/Desktop/Projekt_Website/index.html', 'w', encoding='utf-8') as f:
    f.write(content)


# Read data.js
with open('c:/Users/leona/Desktop/Projekt_Website/data.js', 'r', encoding='utf-8') as f:
    data_content = f.read()

# Replace emojis with nice SVG paths in data.js
ico_kitchen = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>' # just using generic nice shapes for minimal
ico_trash = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>'
ico_bath = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 11h.01"/><path d="M11 15h.01"/><path d="M16 16h.01"/><path d="m2 2 20 20"/><path d="M16 2v4"/><path d="M12 2v2"/><path d="M8 2v4"/><path d="M22 22A10 10 0 0 1 2 22"/></svg>' # minimal umbrella/bath shape
# Just use general beautiful abstract icons for apple style:
ico1 = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>'
ico2 = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>'
ico3 = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>'
ico4 = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 22 22 22"/></svg>'
ico5 = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>'

data_content = data_content.replace('"🍳"', f"'{ico1}'")
data_content = data_content.replace('"🗑️"', f"'{ico2}'")
data_content = data_content.replace('"🛁"', f"'{ico3}'")
data_content = data_content.replace('"🧹"', f"'{ico4}'")
data_content = data_content.replace('"🛋️"', f"'{ico5}'")

with open('c:/Users/leona/Desktop/Projekt_Website/data.js', 'w', encoding='utf-8') as f:
    f.write(data_content)


# Read app.js
with open('c:/Users/leona/Desktop/Projekt_Website/app.js', 'r', encoding='utf-8') as f:
    app_content = f.read()

# Replace emojis in app.js
# ✅ -> <svg...> 
ico_check_text = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; vertical-align:text-bottom;"><polyline points="20 6 9 17 4 12"></polyline></svg>'
app_content = app_content.replace('✅ Erledigt', f'{ico_check_text}Erledigt')
app_content = app_content.replace('✅', '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>')

# ⏳ -> <svg...>
ico_clock_text = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; vertical-align:text-bottom;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'
app_content = app_content.replace('⏳ Offen', f'{ico_clock_text}Offen')

# ✏️ Edit -> Bearbeiten SVG
ico_edit = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; vertical-align:text-bottom;"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>'
app_content = app_content.replace('✏️ Edit', f'{ico_edit} Bearbeiten')

# 🗑️ Löschen -> Delete SVG
ico_delete = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; vertical-align:text-bottom;"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>'
app_content = app_content.replace('🗑️ Löschen', f'{ico_delete} Löschen')

with open('c:/Users/leona/Desktop/Projekt_Website/app.js', 'w', encoding='utf-8') as f:
    f.write(app_content)
    
print("Replaced emojis with SVGs!")
