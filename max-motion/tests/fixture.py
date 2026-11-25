"""Create a one-second offline visual + audio fixture; run in a temp directory."""
from PIL import Image, ImageDraw
from pathlib import Path
import subprocess, imageio_ffmpeg
im=Image.new('RGB',(240,144));p=im.load()
for y in range(144):
 for x in range(240):p[x,y]=(30+x//2,18+y//2,35+(x+y)//3)
d=ImageDraw.Draw(im);d.rectangle((2,8,75,129),fill=(0,220,0));d.ellipse((60,10,120,72),fill=(255,238,203));d.rectangle((150,15,205,130),fill=(200,55,80))
for j in range(12):d.line((100+j*4,75,70+j*4,135),fill=(198,229,238),width=2)
im.save('fx-fixture.png');subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-loglevel','error','-y','-loop','1','-i','fx-fixture.png','-f','lavfi','-i','sine=frequency=470:sample_rate=48000','-t','2','-r','24','-c:v','libvpx','-b:v','550k','-pix_fmt','yuv420p','-c:a','libopus','fx-fixture.webm'],check=True)
