import 'package:flutter/material.dart';

abstract final class Mx {
  static const canvas = Color(0xff101010), panel = Color(0xff191919),
      selected = Color(0xff211b10), gold = Color(0xffd9a52e), lightGold = Color(0xfff5d77e),
      shade = Color(0xffa87819), ink = Color(0xffffffff), muted = Color(0xffb8b2a5),
      line = Color(0xff35312a), success = Color(0xff49b879), error = Color(0xffe05252);
  static const control = BorderRadius.all(Radius.circular(8));
  static const card = BorderRadius.all(Radius.circular(12));
  static const drawer = BorderRadius.all(Radius.circular(20));
  static ThemeData get theme {
    const colors=ColorScheme.dark(primary:gold,onPrimary:canvas,secondary:lightGold,
      onSecondary:canvas,surface:panel,onSurface:ink,onSurfaceVariant:muted,
      outline:line,error:error,onError:canvas,primaryContainer:selected,onPrimaryContainer:lightGold);
    final base=ThemeData(useMaterial3:true,colorScheme:colors,fontFamily:'Tajawal');
    return base.copyWith(scaffoldBackgroundColor:canvas,dividerColor:line,focusColor:lightGold,
      textTheme:base.textTheme.copyWith(
        bodyMedium:const TextStyle(fontFamily:'Tajawal',fontSize:16,height:1.5,fontWeight:FontWeight.w400,color:ink),
        titleLarge:const TextStyle(fontFamily:'Tajawal',fontSize:24,height:1.3,fontWeight:FontWeight.w700,color:ink),
        titleMedium:const TextStyle(fontFamily:'Tajawal',fontSize:18,height:1.4,fontWeight:FontWeight.w500,color:ink),
      ),
      appBarTheme:const AppBarTheme(backgroundColor:canvas,foregroundColor:ink,surfaceTintColor:Colors.transparent),
      filledButtonTheme:FilledButtonThemeData(style:FilledButton.styleFrom(backgroundColor:gold,foregroundColor:canvas,minimumSize:const Size(48,48),shape:const RoundedRectangleBorder(borderRadius:control),textStyle:const TextStyle(fontFamily:'Tajawal',fontSize:16,fontWeight:FontWeight.w500))),
      outlinedButtonTheme:OutlinedButtonThemeData(style:OutlinedButton.styleFrom(foregroundColor:ink,minimumSize:const Size(48,48),shape:const RoundedRectangleBorder(borderRadius:control),textStyle:const TextStyle(fontFamily:'Tajawal',fontSize:16,fontWeight:FontWeight.w500))),
      drawerTheme:const DrawerThemeData(shape:RoundedRectangleBorder(borderRadius:drawer)),
      inputDecorationTheme:const InputDecorationTheme(filled:true,fillColor:canvas,contentPadding:EdgeInsets.all(12),
        enabledBorder:OutlineInputBorder(borderRadius:control,borderSide:BorderSide(color:muted)),
        focusedBorder:OutlineInputBorder(borderRadius:control,borderSide:BorderSide(color:lightGold,width:2))),
    );
  }
}
class BrandMark extends StatelessWidget {
  const BrandMark({super.key,this.size=32});final double size;
  @override Widget build(BuildContext context)=>Image.asset('assets/brand/mark.png',width:size,height:size,excludeFromSemantics:true);
}
class MxIcon extends StatelessWidget {
  const MxIcon(this.name,{super.key});final String name;
  @override Widget build(BuildContext context)=>ImageIcon(AssetImage('assets/brand/icons/$name.png'),size:24);
}
class MxPanel extends StatelessWidget {
  const MxPanel({super.key,required this.child});final Widget child;
  @override Widget build(BuildContext context)=>DecoratedBox(decoration:BoxDecoration(color:Mx.panel,border:Border.all(color:Mx.line),borderRadius:Mx.card),child:Padding(padding:const EdgeInsets.all(16),child:child));
}
