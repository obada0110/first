import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../app/locale_controller.dart';
import '../../app/design/max_theme.dart';
import 'source_timeline.dart';
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
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final duration = data['duration'] as int?, pos = data['position'] as int? ?? 0;
    final stage = data['export'] ?? 'idle';
    final exporting = stage == 'exporting' || stage == 'publishing';
    final locked = busy || exporting;
    final issue = data['issue'] as String? ?? '';
    final note = message(t,error.isNotEmpty ? error : issue.isNotEmpty ? issue : exporting ? '' : stage);
    final theme = Theme.of(context).textTheme;
    final open = FilledButton.icon(key:const ValueKey('import'),onPressed:locked?null:()=>run('open'),icon:const MxIcon('import'),label:Text(t.importVideo));
    final status = note.isEmpty ? const SizedBox.shrink() : Padding(padding:const EdgeInsets.symmetric(vertical:8),child:Semantics(liveRegion:true,child:Text(note,style:TextStyle(color:error.isEmpty&&issue.isEmpty&&stage=='done'?Mx.success:stage=='cancelled'?Mx.muted:Mx.error))));
    final header=Row(children:[const BrandMark(),const SizedBox(width:8),Expanded(child:Text(t.appTitle,style:theme.titleLarge)),IconButton(key:const ValueKey('settings'),tooltip:t.settings,icon:const MxIcon('settings'),onPressed:(){run('close');Navigator.of(context).push(MaterialPageRoute<void>(builder:(_)=>SettingsScreen(controller:widget.controller)));})]);
    Widget content(){
      if(duration==null){
        return Center(child:SingleChildScrollView(padding:const EdgeInsets.all(16),child:ConstrainedBox(constraints:const BoxConstraints(maxWidth:480),child:MxPanel(key:const ValueKey('empty-project'),child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,mainAxisSize:MainAxisSize.min,children:[
          const Align(alignment:AlignmentDirectional.centerStart,child:BrandMark(size:48)),const SizedBox(height:24),Text(t.newProject,style:theme.titleLarge),const SizedBox(height:8),Text(t.emptyHint),if(data['name']!=null)Text(data['name'] as String),status,const SizedBox(height:16),open,
        ])))));
      }
      final monitor=Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[
        Text(data['name'] as String? ?? t.preview,style:theme.titleMedium),const SizedBox(height:8),
        ClipRRect(borderRadius:Mx.card,child:SizedBox(height:180,child:ColoredBox(color:Mx.canvas,child:AndroidView(viewType:'max_editor/preview',layoutDirection:Directionality.of(context))))),
        const SizedBox(height:8),Text(t.sourceDetails(data['w'],data['h'],data['rot'],data['fps']==null?t.unknownRate:t.sourceRate(data['fps']),data['audio']==true?t.withAudio:t.silent),style:theme.labelLarge),
        const SizedBox(height:8),Wrap(spacing:8,runSpacing:8,crossAxisAlignment:WrapCrossAlignment.center,children:[OutlinedButton.icon(onPressed:locked?null:()=>run('play'),icon:MxIcon(data['playing']==true?'pause':'play'),label:Text(data['playing']==true?t.pause:t.play)),Text(t.positionTime(t.position,(pos/1e6).toStringAsFixed(2),(duration/1e6).toStringAsFixed(2)))]),
        const SizedBox(height:12),MxPanel(child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[Text(t.timeline,style:theme.titleMedium),SourceTimeline(duration:duration,position:drag??pos.toDouble(),start:data['from'],end:data['to'],onChanged:locked?null:(v)=>setState(()=>drag=v),onEnd:(v){setState(()=>drag=null);run('seek',{'us':v.round()});})])),
      ]);
      Widget field(TextEditingController ctrl,String label)=>TextField(enabled:!locked,controller:ctrl,textDirection:TextDirection.ltr,keyboardType:const TextInputType.numberWithOptions(decimal:true),decoration:InputDecoration(labelText:label));
      final inspector=MxPanel(child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[Text(t.properties,style:theme.titleMedium),const SizedBox(height:12),
        Wrap(spacing:8,runSpacing:8,children:[OutlinedButton(onPressed:locked?null:()=>trim(pos,data['to']),child:Text(t.startHere)),OutlinedButton(onPressed:locked?null:()=>trim(data['from'],pos),child:Text(t.endHere))]),const SizedBox(height:16),
        LayoutBuilder(builder:(ctx,box){final a=field(start,t.startMs),b=field(end,t.endMs);return box.maxWidth >= 320*MediaQuery.textScalerOf(ctx).scale(1)?Row(children:[Expanded(child:a),const SizedBox(width:12),Expanded(child:b)]):Column(children:[a,const SizedBox(height:12),b]);}),
        const SizedBox(height:8),OutlinedButton.icon(onPressed:locked?null:(){FocusScope.of(context).unfocus();trim(readUs(start.text),readUs(end.text));},icon:const MxIcon('save'),label:Text(t.applyRange)),const SizedBox(height:8),Text(t.selectedTime(t.selection,((data['to']-data['from'])/1e6).toStringAsFixed(3))),const SizedBox(height:12),
        if(!exporting)FilledButton.icon(onPressed:locked?null:()=>run('export'),icon:const MxIcon('export'),label:Text(t.exportVideo)),
        if(exporting)...[Text(stage=='publishing'?t.publishing:t.exporting),LinearProgressIndicator(value:data['percent']==null?null:data['percent']/100),TextButton(onPressed:busy?null:()=>run('cancel'),child:Text(t.cancelExport))],status,
        const Divider(height:32),Text(t.replaceHint,style:theme.labelLarge),OutlinedButton.icon(onPressed:locked?null:()=>run('open'),icon:const MxIcon('import'),label:Text(t.importVideo)),
      ]));
      return LayoutBuilder(builder:(ctx,box){final split=box.maxWidth>=840 || (box.maxWidth>=600 && MediaQuery.orientationOf(ctx)==Orientation.landscape);
        if(split){return Row(key:const ValueKey('panes'),crossAxisAlignment:CrossAxisAlignment.start,children:[Expanded(flex:3,child:SingleChildScrollView(padding:const EdgeInsets.all(12),child:monitor)),Expanded(flex:2,child:SingleChildScrollView(padding:const EdgeInsets.all(12),child:inspector))]);}
        return SingleChildScrollView(padding:const EdgeInsets.all(16),child:Column(children:[monitor,const SizedBox(height:16),inspector]));});
    }
    return Scaffold(body:SafeArea(child:Column(children:[Padding(padding:const EdgeInsets.symmetric(horizontal:16,vertical:4),child:header),const Divider(height:1),Expanded(child:content())])));
  }
}
