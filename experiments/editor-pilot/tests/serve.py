"""Runner-only loopback server. Only predefined synthetic JSON result slots writable."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import sys,json,subprocess
root=Path(sys.argv[1]);proof=Path(sys.argv[2]);
class Host(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(root),**kw)
 def do_POST(self):
  if self.path not in ['/result/webview','/result/android']:return self.send_error(404)
  n=int(self.headers['Content-Length']);assert 0<n<2000000
  raw=self.rfile.read(n);json.loads(raw);
  if self.path=='/result/android':
   (proof/'flutter-pilot.png').write_bytes(subprocess.check_output(['adb','exec-out','screencap','-p'],timeout=15))
  (proof/(self.path.split('/')[-1]+'.json')).write_bytes(raw);self.send_response(200);self.end_headers()
ThreadingHTTPServer(('127.0.0.1',8974),Host).serve_forever()
