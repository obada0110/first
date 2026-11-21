"""Decode and inspect outputs of effects.cjs from its fixture/output directory."""
import subprocess, numpy as np,imageio_ffmpeg as ff
from pathlib import Path
exe=ff.get_ffmpeg_exe()
def frame(name,t=.4):
 raw=subprocess.check_output([exe,'-loglevel','error','-i',name+'.mp4','-ss',str(t),'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-']);return np.frombuffer(raw,'u1').reshape(144,240,3).astype(float)
def audio(name):
 raw=subprocess.check_output([exe,'-loglevel','error','-i',name+'.mp4','-vn','-f','f32le','-ac','1','-ar','8000','-']);a=np.frombuffer(raw,'<f4');assert len(a)>4000 and np.mean(a*a)>.0001
base=frame('neutral');mad=lambda a,b:np.mean(abs(a-b));luma=lambda im:im@np.array([.2126,.7152,.0722]);edges=lambda im:np.mean(abs(np.diff(luma(im),axis=0)))+np.mean(abs(np.diff(luma(im),axis=1)))
for k in ['key','blur','glow','rain','frost','motion','light','contrast','sat','temp']:
 im=frame(k);d=mad(base,im);audio(k);assert d>1,(k,d);print(k,round(d,2));
 if k=='key':assert im[50,30,1]<90 and base[50,30,1]>160
 if k in ['motion','blur']:assert edges(im)<edges(base)
 if k=='light':assert luma(im).mean()<luma(base).mean()-8
 if k=='contrast':assert luma(im).std()>luma(base).std()
 if k=='glow':assert im.mean()>base.mean()
 if k=='frost':assert mad(im[:7],base[:7])>mad(im[60:75,100:140],base[60:75,100:140])+3
 if k=='rain':assert mad(im,frame(k,.7))>1
 if k=='sat':assert np.ptp(im,axis=2).mean()>np.ptp(base,axis=2).mean()
 if k=='temp':assert (im[:,:,0]-im[:,:,2]).mean()>(base[:,:,0]-base[:,:,2]).mean()+5
assert mad(frame('split',.2),base)>5 and mad(frame('split',1.1),base)<4
print('10 independently decoded video/audio files and per-piece export verified.')
