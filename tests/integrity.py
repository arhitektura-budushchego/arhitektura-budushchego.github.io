"""Check manuscript/download invariants against the pre-change checkpoint."""
from pathlib import Path
import re
import subprocess
root = Path(__file__).parents[1]
base = 'b068dbd491b63798bf3493d4b2865dc6fbefaf47'
count = 0
for p in root.glob('*.html'):
    if not re.fullmatch(r'(chapter-\d+|introduction)\.html', p.name): continue
    old = subprocess.check_output(['git','show',base+':'+p.name],cwd=root).decode()
    for pattern in [r'<main.*?</main>',r'<header.*?</header>']:
        assert re.search(pattern,old,re.S).group() == re.search(pattern,p.read_text(),re.S).group(),p.name
    assert p.read_text().count('src="analytics/analytics.js"') == 1
    count += 1
for p in list(root.glob('arhitektura-budushchego*')) + [root/'app.js',root/'style.css',root/'checksums.sha256',root/'audio/manifest.json']:
    if not p.is_file(): continue
    old = subprocess.check_output(['git','show',base+':'+str(p.relative_to(root))],cwd=root)
    assert old == p.read_bytes(),p.name
print(f'PASS: {count} book pages retain exact main/header content; downloads, reading and audio code unchanged.')
