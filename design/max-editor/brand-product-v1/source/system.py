"""Build editable brand studies, extending the preliminary phase-A geometry (not final trademark)."""
from pathlib import Path
import json,re
R=Path(__file__).resolve().parents[1];A=R/'assets';G=A/'logo';mark=(G/'mark-metal.svg').read_text();path=re.search(r'<path fill="url\(#metal\)" d="([^"]+)',mark)[1]
def svg(w,h,s):return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{s}</svg>'
def letter(c):return f'<path fill="{c}" d="{path}"/>'
(G/'mark-one-ink.svg').write_text(svg(96,96,letter('currentColor')))
(G/'mark-reverse.svg').write_text(svg(96,96,letter('#FFFFFF')))
for variant,bg,fg in [('light','#F6F4ED','#211B10'),('dark','#101010','#FFFFFF')]:
 (G/f'lockup-{variant}.svg').write_text(svg(390,96,f'<rect width="390" height="96" rx="12" fill="{bg}"/><g transform="translate(12 12) scale(.75)">'+(mark[mark.index('<defs>'):mark.index('</svg>')] if variant=='dark' else letter('#805C13'))+f'</g><text x="99" y="61" fill="{fg}" font-family="Arial,sans-serif" font-size="36" font-weight="700" letter-spacing="2">MAX EDITOR</text>'))
(G/'android-background.svg').write_text(svg(108,108,'<rect width="108" height="108" fill="#101010"/>'))
fg='<g transform="translate(20.4 20.4) scale(.7)">'+mark[mark.index('<defs>'):mark.index('</svg>')]+'</g>'; (G/'android-foreground.svg').write_text(svg(108,108,fg));(G/'android-monochrome.svg').write_text(svg(108,108,'<g transform="translate(20.4 20.4) scale(.7)">'+letter('#000')+'</g>'));(G/'android-icon-study.svg').write_text(svg(108,108,'<rect width="108" height="108" rx="24" fill="#101010"/>'+fg));
icons=json.loads((A/'symbols-source.json').read_text());t=json.loads((A/'tokens.json').read_text());stroke=t['icon']['stroke'];(A/'icons.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg">'+''.join(f'<symbol id="{k}" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="{stroke}" stroke-linejoin="round" stroke-linecap="round"><path d="{v}"/></symbol>' for k,v in icons.items())+'</svg>')
