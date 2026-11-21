import 'package:flutter/material.dart';
import '../../app/design/max_theme.dart';

/// A view of the existing v1 range, not a second edit model. Only the slider seeks.
class SourceTimeline extends StatelessWidget {
  const SourceTimeline({super.key,required this.duration,required this.position,required this.start,required this.end,required this.onChanged,required this.onEnd});
  final int duration,start,end;
  final double position;
  final ValueChanged<double>? onChanged;
  final ValueChanged<double> onEnd;
  @override Widget build(BuildContext context)=>Directionality(textDirection:TextDirection.ltr,child:Column(children:[
    Slider(key:const ValueKey('source-clock'),min:0,max:duration.toDouble(),value:position.clamp(0,duration.toDouble()),onChanged:onChanged,onChangeEnd:onEnd,padding:const EdgeInsets.symmetric(vertical:12)),
    SizedBox(height:24,width:double.infinity,child:CustomPaint(painter:_Strip(start/duration,end/duration,(position/duration).clamp(0,1)))),
  ]));
}
class _Strip extends CustomPainter {
  const _Strip(this.a,this.b,this.t);final double a,b,t;
  @override void paint(Canvas canvas,Size size){final p=Paint(),w=size.width;canvas.drawRect(Offset.zero&size,p..color=Mx.line);canvas.drawRect(Rect.fromLTRB(w*a,4,w*b,size.height),p..color=Mx.selected);p..color=Mx.shade..strokeWidth=1;for(var i=0;i<=8;i++){final x=w*i/8;canvas.drawLine(Offset(x,0),Offset(x,4),p);}p..color=Mx.gold..strokeWidth=3;for(final x in [a*w,b*w]){canvas.drawLine(Offset(x,4),Offset(x,size.height),p);}canvas.drawLine(Offset(w*t,0),Offset(w*t,size.height),p..color=Mx.lightGold..strokeWidth=2);}
  @override bool shouldRepaint(_Strip old)=>a!=old.a||b!=old.b||t!=old.t;
}
