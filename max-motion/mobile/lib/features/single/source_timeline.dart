import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../app/design/max_theme.dart';
import '../../l10n/generated/app_localizations.dart';

String timecode(int us) {
  final m = us ~/ 1000;
  return '${(m ~/ 60000).toString().padLeft(2, '0')}:${(m ~/ 1000 % 60).toString().padLeft(2, '0')}.${(m % 1000).toString().padLeft(3, '0')}';
}

class SourceTimeline extends StatelessWidget {
  const SourceTimeline({
    super.key,
    required this.duration,
    required this.position,
    required this.start,
    required this.end,
    required this.name,
    required this.selected,
    required this.onSelect,
    required this.onChanged,
    required this.onEnd,
  });
  final int duration, start, end;
  final String name;
  final bool selected;
  final VoidCallback onSelect;
  final double position;
  final ValueChanged<double>? onChanged;
  final ValueChanged<double> onEnd;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final max = math.max(1, duration);
    final clipLabel = '${t.assetId}   ·   \u2068$name\u2069';
    return ColoredBox(
      color: Mx.panel,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const MxIcon('layers'),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    t.timeline,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                Text(t.assetId, style: const TextStyle(color: Mx.muted)),
              ],
            ),
            Directionality(
              textDirection: TextDirection.ltr,
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      for (final v in [0, max ~/ 2, max])
                        Flexible(
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Text(
                              timecode(v),
                              style: const TextStyle(
                                fontSize: 12,
                                color: Mx.muted,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                  Slider(
                    key: const ValueKey('source-clock'),
                    max: max.toDouble(),
                    value: position.clamp(0, max.toDouble()),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    onChanged: onChanged,
                    onChangeEnd: onEnd,
                  ),
                  Semantics(
                    button: true,
                    selected: selected,
                    label: t.trackHint,
                    child: InkWell(
                      key: const ValueKey('clip'),
                      onTap: onSelect,
                      child: SizedBox(
                        height: 48,
                        width: double.infinity,
                        child: CustomPaint(
                          painter: _Strip(
                            start / max,
                            end / max,
                            position / max,
                            selected,
                          ),
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                              ),
                              child: Text(
                                clipLabel,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Strip extends CustomPainter {
  const _Strip(this.a, this.b, this.p, this.selected);
  final double a, b, p;
  final bool selected;
  @override
  void paint(Canvas c, Size s) {
    final w = s.width, h = s.height, paint = Paint();
    c.drawRect(Offset.zero & s, paint..color = Mx.canvas);
    final range = Rect.fromLTRB(a * w, 3, b * w, h - 3);
    c.drawRect(range, paint..color = Mx.selected);
    c.drawRect(
      range,
      paint
        ..color = (selected ? Mx.gold : Mx.muted)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );
    paint.style = PaintingStyle.fill;
    for (int i = 0; i <= 16; i++) {
      final x = w * i / 16;
      c.drawLine(
        Offset(x, 0),
        Offset(x, i % 4 == 0 ? 6 : 3),
        paint..color = Mx.muted,
      );
    }
    final x = p.clamp(0.0, 1.0) * w;
    c.drawLine(
      Offset(x, 0),
      Offset(x, h),
      paint
        ..color = Mx.lightGold
        ..strokeWidth = 2,
    );
  }

  @override
  bool shouldRepaint(_Strip old) =>
      a != old.a || b != old.b || p != old.p || selected != old.selected;
}
