import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show PlatformViewHitTestBehavior;
import 'package:flutter/services.dart';

/// Put the actual PlayerView in the Android view hierarchy. A TextureView
/// composited into a second texture can show black while ExoPlayer advances.
/// No second player, decoder, or native edit path is created here.
class SourceMonitor extends StatelessWidget {
  const SourceMonitor({super.key});
  static const kind = 'max_editor/preview';
  @override
  Widget build(BuildContext context) => ColoredBox(
    color: Colors.black,
    child: PlatformViewLink(
      viewType: kind,
      surfaceFactory: (_, controller) => AndroidViewSurface(
        controller: controller as AndroidViewController,
        gestureRecognizers: const {},
        hitTestBehavior: PlatformViewHitTestBehavior.transparent,
      ),
      onCreatePlatformView: (params) =>
          PlatformViewsService.initExpensiveAndroidView(
              id: params.id,
              viewType: kind,
              layoutDirection: Directionality.of(context),
              onFocus: () => params.onFocusChanged(true),
            )
            ..addOnPlatformViewCreatedListener(params.onPlatformViewCreated)
            ..create(),
    ),
  );
}
