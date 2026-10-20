import re

css_path = 'c:/Users/leona/Desktop/Projekt_Website/style.css'
html_path = 'c:/Users/leona/Desktop/Projekt_Website/index.html'

with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

# Replace the font import to only include Inter
css = re.sub(
    r"@import url\('https://fonts.googleapis.com/css2\?family=Inter.*?display=swap'\);",
    "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');",
    css
)

# Remove the specific h1-h6 block that overrides font-family
css = re.sub(r'h1, h2, h3, h4, h5, h6, \.serif\s*\{[^}]*\}', '', css)

# Remove all Playfair Display font-family declarations
css = re.sub(r"font-family:\s*'Playfair Display',\s*serif;\s*", "", css)

# Remove all italic font styles
css = re.sub(r"font-style:\s*italic;\s*", "", css)

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(css)

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Update cache buster
html = re.sub(r'style\.css\?v=\d+', 'style.css?v=26', html)

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)
