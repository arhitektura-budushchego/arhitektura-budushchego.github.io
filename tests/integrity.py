"""Validate book/analytics invariants and byte-identical audiobook assets."""
from pathlib import Path
import hashlib,json,re,subprocess
root=Path(__file__).parents[1]
base='7b3e47f42ae3609fb27b09ea3ef74bb64b7dd1d7'
def original(path):return subprocess.check_output(['git','show',base+':'+str(path)],cwd=root)
for p in root.glob('*.html'):
 if not re.fullmatch(r'(chapter-\d+|introduction)\.html',p.name):continue
 old=original(p.name).decode()
 assert re.search(r'<main.*?</main>',old,re.S).group()==re.search(r'<main.*?</main>',p.read_text(),re.S).group(),p.name
 assert p.read_text().count('src="audiobook.js?v=1"')==1
 assert p.read_text().count('src="analytics/analytics.js"')==1
for p in list(root.glob('arhitektura-budushchego*'))+[root/'style.css',root/'checksums.sha256']+list((root/'analytics').glob('*')):
 if p.is_file():assert original(p.relative_to(root))==p.read_bytes(),p.name
old=original('app.js').decode();marker='// Audio remains invisible until an approved MP3 has loaded valid metadata.'
assert old[:old.index(marker)].strip()==(root/'app.js').read_text().strip(),'Reading code changed'
manifest=json.loads((root/'audio/manifest.json').read_text());assert len(manifest['tracks'])==15
for t in manifest['tracks']:
 p=root/t['src'];assert p.stat().st_size==t['bytes']
 assert hashlib.sha256(p.read_bytes()).hexdigest()==t['sha256'],p.name
 page=(root/t['page']).read_text()
 title=re.search(r'<h1[^>]*>(.*?)</h1>',page,re.S).group(1)
 if t['id']!='introduction':assert title==t['title'],t['id']
print('PASS: text of 15 book pages, reading code, analytics and downloads unchanged; all 15 original MP3 hashes match.')
