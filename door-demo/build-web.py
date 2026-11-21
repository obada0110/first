"""Create a light web player from the self-contained offline game.
Usage: python door-demo/build-web.py <revision containing published scenery>
The result can run even when all external scenery requests fail.
"""
import base64, json, re, sys
from pathlib import Path
root=Path(__file__).parent
s=(root/'index.html').read_text()
get=lambda tag:re.search(f'<{tag}>(.*?)</{tag}>',s,re.S)[1]
script=get('script'); group=re.search(r'const art=(\["data:image/webp;base64,.*?\])\.map\(src=>\{const im=new Image\(\);im.src=src;return im\}\);',script)
images=json.loads(group[1]); out=root/'scenery'; out.mkdir(exist_ok=True)
for i,img in enumerate(images): (out/f'{i}.webp').write_bytes(base64.b64decode(img.split(',',1)[1]))
if len(sys.argv)==1:sys.exit(0)
rev=sys.argv[1];assert re.fullmatch('[a-f0-9]{40}',rev)
script=script[:group.start()]+'''const art=[];function sceneImage(n){if(!art[n]){const im=art[n]=new Image();im.decoding='async';im.src='https://raw.githubusercontent.com/obada0110/first/REV/door-demo/scenery/'+n+'.webp'}return art[n]};'''.replace('REV',rev)+script[group.end():]
script=script.replace('const image=art[idx]','const image=sceneImage(idx)').replace('else rect(0,0,bw,bh,P[2]);','''else {const sky=g.createLinearGradient(0,0,0,bh);sky.addColorStop(0,P[0]);sky.addColorStop(1,P[3]);rect(0,0,bw,bh,sky);circ(bw*.75,bh*.22,Math.min(bh*.09,bw*.10),'#ffdfa4');for(let n=0;n<2;n++){const pts=[[0,bh]];for(let i=0;i<=60;i++)pts.push([bw*i/60,bh*(.55+n*.16+.08*Math.sin(i*.17+n)+.04*Math.cos(i*.59))]);pts.push([bw,bh]);poly(pts,P[n+2])}}''')
# Moving focus from the host to the sandboxed player is not an in-game pause.
script=script.replace("window.addEventListener('blur',suspend)","window.addEventListener('blur',()=>{clear();buf=0})")
cfg={'title':'لا تثق بالباب!','mode':'result','htmlAttrs':{'dir':'rtl','lang':'ar'},'markup':{'language':'html','content':'<main>'+get('main')+'</main>'},'style':{'language':'css','content':get('style')},'script':{'language':'javascript','content':script},'autoupdate':True}
(root/'play.json').write_text(json.dumps(cfg,ensure_ascii=False,separators=(',',':'))+'\n')
