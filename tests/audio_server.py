from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os,re
os.chdir(Path(__file__).resolve().parents[1])
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
 def send_head(self):
  path=Path(self.translate_path(self.path))
  if path.is_file() and path.suffix=='.mp3' and self.headers.get('Range'):
   size=path.stat().st_size
   match=re.fullmatch(r'bytes=(\d+)-(\d*)',self.headers['Range'])
   if not match:return super().send_head()
   start=int(match[1]);end=min(int(match[2]) if match[2] else size-1,size-1)
   if start>=size:self.send_error(416);return
   self.send_response(206);self.send_header('Content-Type','audio/mpeg');self.send_header('Accept-Ranges','bytes')
   self.send_header('Content-Range',f'bytes {start}-{end}/{size}');self.send_header('Content-Length',str(end-start+1));self.end_headers()
   self.remaining=end-start+1;f=path.open('rb');f.seek(start);return f
  return super().send_head()
 def copyfile(self,source,output):
  if hasattr(self,'remaining'):
   try:
    remaining=self.remaining
    while remaining:
     b=source.read(min(65536,remaining))
     if not b:break
     output.write(b);remaining-=len(b)
   except (BrokenPipeError,ConnectionResetError):pass
   finally:del self.remaining
  else:
   try:super().copyfile(source,output)
   except (BrokenPipeError,ConnectionResetError):pass
ThreadingHTTPServer(('127.0.0.1',8765),Handler).serve_forever()
