import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../app/locale_controller.dart';
import '../../l10n/generated/app_localizations.dart';
import '../settings/settings_screen.dart';

class SingleScreen extends StatefulWidget {
  const SingleScreen({super.key, required this.controller});
  final LocaleController controller;
  @override
  State<SingleScreen> createState() => _SingleState();
}

class _SingleState extends State<SingleScreen> {
  static const api = MethodChannel('max_editor/single/v1');
  Map<dynamic,dynamic> data = {};
  final start = TextEditingController(), end = TextEditingController();
  Timer? timer;
  String error = '';
  bool busy = false, querying = false;
  double? drag;
  @override
  void initState(){super.initState(); run('restore');timer=Timer.periodic(const Duration(milliseconds:250),(_)=>refresh());}
  @override
  void dispose(){timer?.cancel();start.dispose();end.dispose();super.dispose();}
  void apply(Map<dynamic,dynamic>? next){
    if (!mounted || next==null) return;
    if(next['name']!=data['name'] || next['revision']!=data['revision'] || next['to']!=data['to']){
      start.text=ms(next['from']??0);end.text=ms(next['to']??0);
    }
    setState(()=>data=next);
  }
  static String ms(int us)=>(us/1000).toStringAsFixed(us%1000==0?0:3);
  Future<void> refresh() async {
    if(!mounted || busy || querying || data.isEmpty)return;
    querying=true;
    try {apply(await api.invokeMapMethod('state'));} on PlatformException { /* Next tick retries. */ } finally {querying=false;}
  }
  Future<void> run(String method,[Map<String,dynamic>? args]) async {
    if(busy)return;setState((){busy=true;error='';});
    try{await api.invokeMethod(method,args);apply(await api.invokeMapMethod('state'));}
    on PlatformException catch(e){try{apply(await api.invokeMapMethod('state'));}on PlatformException catch(_){/* Preserve the original error. */}if(mounted)setState(()=>error=e.code);}
    on MissingPluginException { /* Widget tests have no Android channel. */ }
    finally{if(mounted)setState(()=>busy=false);}
  }
  void trim(int? a,int? b){if(a==null||b==null){setState(()=>error='range');return;}run('range',{'from':a,'to':b,'revision':data['revision']});}
  int? readUs(String s){final n=double.tryParse(s);return n!=null && n.isFinite && n.abs()<1e9?(n*1000).round():null;}
  String message(AppLocalizations t,String code)=>switch(code){'invalid'=>t.invalidVideo,'missing'=>t.missingSource,'range'=>t.badRange,'save'=>t.projectError,'playError'=>t.playError,'exportError'=>t.exportError,'space'=>t.spaceError,'cancelled'=>t.cancelled,'done'=>'${t.savedTo}: ${data['destination']}', ''||'idle'=>'',_=>t.projectError};
  @override
  Widget build(BuildContext context){
    final t=AppLocalizations.of(context);final d=data['duration'] as int?, pos=(data['position'] as int?)??0;
    final stage=data['export']??'idle';final exporting=stage=='exporting'||stage=='publishing';final lock=busy||exporting;
    final note=message(t,error.isNotEmpty?error:(data['issue'] as String? ?? '').isNotEmpty?data['issue']:exporting?'':stage);
    return Scaffold(appBar:AppBar(title:Text(t.single),actions:[IconButton(key:const ValueKey('settings'),tooltip:t.settings,icon:const Icon(Icons.settings),onPressed:(){run('close');Navigator.of(context).push(MaterialPageRoute<void>(builder:(_)=>SettingsScreen(controller:widget.controller)));})]),body:SafeArea(child:ListView(padding:const EdgeInsets.all(14),children:[
      FilledButton.icon(onPressed:lock?null:()=>run('open'),icon:const Icon(Icons.video_file),label:Text(t.importVideo)),
      if(d==null)Padding(padding:const EdgeInsets.only(top:24),child:Text(t.emptyHint)),
      if(data['name']!=null)Text('${data['name']}'),
      if(d!=null)...[
        SizedBox(height:170,child:ColoredBox(color:Colors.black,child:AndroidView(viewType:'max_editor/preview',layoutDirection:Directionality.of(context)))),
        Text('${data['w']} × ${data['h']} · ${data['rot']}° · ${data['fps']==null?t.unknownRate:"${data['fps']} fps"} · ${data['audio']==true?t.withAudio:t.silent}'),
        Text('${t.position}: ${(pos/1e6).toStringAsFixed(2)} / ${(d/1e6).toStringAsFixed(2)} s'),
        Slider(value:(drag??pos.toDouble()).clamp(0,d.toDouble()),max:d.toDouble(),onChanged:lock?null:(v)=>setState(()=>drag=v),onChangeEnd:(v){setState(()=>drag=null);run('seek',{'us':v.round()});}),
        Wrap(spacing:6,children:[OutlinedButton(onPressed:lock?null:()=>run('play'),child:Text(data['playing']==true?t.pause:t.play)),TextButton(onPressed:lock?null:()=>trim(pos,data['to']),child:Text(t.startHere)),TextButton(onPressed:lock?null:()=>trim(data['from'],pos),child:Text(t.endHere))]),
        Row(children:[for(final pair in [(start,t.startMs),(end,t.endMs)])Expanded(child:TextField(enabled:!lock,controller:pair.$1,keyboardType:const TextInputType.numberWithOptions(decimal:true),decoration:InputDecoration(labelText:pair.$2))) ,TextButton(onPressed:lock?null:(){FocusScope.of(context).unfocus();trim(readUs(start.text),readUs(end.text));},child:Text(t.applyRange))]),
        Text('${t.selection}: ${((data['to']-data['from'])/1e6).toStringAsFixed(3)} s'),
        if(!exporting)FilledButton(onPressed:lock?null:()=>run('export'),child:Text(t.exportVideo)),
        if(exporting)...[Text(stage=='publishing'?t.publishing:t.exporting),LinearProgressIndicator(value:data['percent']==null?null:data['percent']/100),TextButton(onPressed:busy?null:()=>run('cancel'),child:Text(t.cancelExport))],
        Text(t.replaceHint),
      ],if(note.isNotEmpty)Semantics(liveRegion:true,child:Text(note)),
    ])));
  }
}
