import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'source_timeline.dart';

class PilotScreen extends StatefulWidget {
 const PilotScreen({super.key});
 @override State<PilotScreen> createState()=>_PilotState();
}
class _PilotState extends State<PilotScreen>{
 static const channel=MethodChannel('max_editor/fixture_pilot'); Map doc={}; int selected=0;double position=0;bool busy=false;String status='';
 List get clips=>doc['mainTrack']['clips'] as List;
 Future<String> host(String m,[dynamic d])async=>(await channel.invokeMethod<String>(m,d))!;
 Future<Map> call(String m,d)async=>jsonDecode(await host('call',jsonEncode({'api':2,'method':m,'data':d}))) as Map;
 Future<void> refresh()async{final r=await call('snapshot',null);doc=jsonDecode(r['value']);if(selected>=clips.length)selected=0;}
 Future<void> run(String op)async{if(busy)return;setState(()=>busy=true);try{
 if(op=='save'){await host(op);}else if(op=='seed'||op=='restore'){final r=jsonDecode(await host(op));if(!r['ok'])throw StateError(r['error']);selected=0;position=0;}else{
 final rev=doc['revision'], c=clips[selected];final cmd=<String,dynamic>{'op':op,'expectedRevision':rev};
 if(op=='addClip'){cmd['clip']={...clips[0] as Map,'id':'extra$rev'};} else if(op=='order'){cmd['ids']=[for(final l in (doc['layers'] as List).reversed)l['id']];}
 else if(['split','trimRight','trimLeft','delete'].contains(op)){cmd['id']=c['id'];if(op!='delete')cmd['atUs']=position.round();if(op=='split')cmd['rightId']='right$rev';}
 final r=await call('edit',cmd);if(!r['ok'])throw StateError(r['error']);}
 await refresh();status='$op:${doc['revision']}';}catch(e){status=e.toString();}finally{if(mounted)setState(()=>busy=false);}}
 @override void initState(){super.initState();run('seed');}
 @override Widget build(BuildContext context){final List cs=doc.isEmpty?[]:clips;int dur=0,start=0,end=0;for(var i=0;i<cs.length;i++){final v=(cs[i]['outUs']-cs[i]['inUs']) as int;if(i==selected){start=dur;end=dur+v;}dur+=v;}
 return Scaffold(appBar:AppBar(title:const Text('مختبر مشروع اصطناعي')),body:SafeArea(child:ListView(children:[if(cs.isNotEmpty)...[
 SourceTimeline(duration:dur,start:start,end:end,name:cs[selected]['id'],position:position,selected:true,onSelect:(){},onChanged:(x)=>setState(()=>position=x),onEnd:(x)=>setState(()=>position=x)),
 Wrap(children:[for(int i=0;i<cs.length;i++) TextButton(key:ValueKey('select:${cs[i]['id']}'),onPressed:()=>setState(()=>selected=i),child:Text(cs[i]['id']))]),Text('Layers: '+(doc['layers'] as List).map((l)=>l['id']).join(' / ')),
 Wrap(children:[for(final k in ['addClip','trimRight','trimLeft','split','delete','order','undo','redo','save','restore','seed']) TextButton(key:ValueKey('op:$k'),onPressed:busy?null:()=>run(k),child:Text(k))])],Text(status,key:const ValueKey('pilot-status'))])));}
}
