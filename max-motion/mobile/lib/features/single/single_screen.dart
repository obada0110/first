import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../app/locale_controller.dart';
import '../../app/design/max_theme.dart';
import 'source_timeline.dart';
import 'project_library.dart';

import '../../l10n/generated/app_localizations.dart';
import '../settings/settings_screen.dart';

String _isolate(Object? value) => '\u2068$value\u2069';

enum _Tool { source, trim, export }

class SingleScreen extends StatefulWidget {
  const SingleScreen({super.key, required this.controller});
  final LocaleController controller;
  @override
  State<SingleScreen> createState() => _SingleState();
}

class _SingleState extends State<SingleScreen> {
  static const api = MethodChannel('max_editor/single/v1');
  Map<dynamic, dynamic> data = {};
  final start = TextEditingController(), end = TextEditingController();
  Timer? timer;
  String error = '';
  bool busy = false, querying = false;
  double? drag;
  bool library = true, restoring = true, committed = false;
  _Tool tool = _Tool.source;
  void resetDraft() {
    start.text = ms(data['from'] ?? 0);
    end.text = ms(data['to'] ?? 0);
  }

  void select(_Tool value) {
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      tool = value;
    });
  }

  @override
  void initState() {
    super.initState();
    run('restore');
    timer = Timer.periodic(const Duration(milliseconds: 250), (_) => refresh());
  }

  @override
  void dispose() {
    timer?.cancel();
    start.dispose();
    end.dispose();
    super.dispose();
  }

  void apply(Map<dynamic, dynamic>? next) {
    if (!mounted || next == null) return;
    if (next['name'] != data['name'] ||
        next['revision'] != data['revision'] ||
        next['to'] != data['to']) {
      start.text = ms(next['from'] ?? 0);
      end.text = ms(next['to'] ?? 0);
    }
    setState(() {
      if (!restoring && data['duration'] == null && next['duration'] != null) {
        library = false;
      }
      data = next;
    });
  }

  static String ms(int us) =>
      (us / 1000).toStringAsFixed(us % 1000 == 0 ? 0 : 3);
  Future<void> refresh() async {
    if (!mounted || busy || querying || data.isEmpty) return;
    querying = true;
    try {
      apply(await api.invokeMapMethod('state'));
    } on PlatformException {
      /* Next tick retries. */
    } finally {
      querying = false;
    }
  }

  Future<void> run(String method, [Map<String, dynamic>? args]) async {
    if (busy) return;
    setState(() {
      busy = true;
      error = '';
    });
    try {
      final result = await api.invokeMethod(method, args);
      apply(await api.invokeMapMethod('state'));
      if (mounted && method == 'open' && result != null) {
        setState(() {
          library = false;
          tool = _Tool.source;
          committed = false;
          resetDraft();
        });
      }
      if (mounted && method == 'range') {
        setState(() {
          committed = true;
          resetDraft();
        });
      }
    } on PlatformException catch (e) {
      try {
        apply(await api.invokeMapMethod('state'));
      } on PlatformException catch (_) {
        /* Preserve the original error. */
      }
      if (mounted) setState(() => error = e.code);
    } on MissingPluginException {
      /* Widget tests have no Android channel. */
    } finally {
      if (mounted) {
        setState(() {
          busy = false;
          if (method == 'restore') restoring = false;
        });
      }
    }
  }

  void trim(int? a, int? b) {
    if (a == null || b == null) {
      setState(() => error = 'range');
      return;
    }
    run('range', {'from': a, 'to': b, 'revision': data['revision']});
  }

  int? readUs(String s) {
    final n = double.tryParse(s);
    return n != null && n.isFinite && n.abs() < 1e9 ? (n * 1000).round() : null;
  }

  String message(AppLocalizations t, String code) => switch (code) {
    'invalid' => t.invalidVideo,
    'missing' => t.missingSource,
    'range' => t.badRange,
    'save' => t.projectError,
    'playError' => t.playError,
    'exportError' => t.exportError,
    'space' => t.spaceError,
    'cancelled' => t.cancelled,
    'done' => '${t.savedTo}: ${data['destination']}',
    '' || 'idle' => '',
    _ => t.projectError,
  };
  Future<void> openSource() async {
    final t = AppLocalizations.of(context);
    if (data['name'] != null) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(t.replace),
          content: Text(t.replaceHint),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(t.cancel),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(t.importVideo),
            ),
          ],
        ),
      );
      if (ok != true || !mounted) return;
    }
    await run('open');
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context), type = Theme.of(context).textTheme;
    final d = data['duration'] as int?, pos = data['position'] as int? ?? 0;
    final a = data['from'] as int? ?? 0,
        b = data['to'] as int? ?? 0,
        name = data['name'] as String?;
    final stage = data['export'] ?? 'idle';
    final exporting = stage == 'exporting' || stage == 'publishing',
        home = library || d == null;
    final locked = busy || exporting;
    final issue = data['issue'] as String? ?? '';
    final note = message(
      t,
      error.isNotEmpty
          ? error
          : issue.isNotEmpty
          ? issue
          : exporting
          ? ''
          : stage,
    );
    final range = '${timecode(a)}  →  ${timecode(b)}';
    void goHome() {
      if (locked) return;
      run('close');
      setState(() => library = true);
    }

    void settings() {
      if (!home) run('close');
      Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => SettingsScreen(controller: widget.controller),
        ),
      );
    }

    final header = Row(
      children: [
        if (!home)
          IconButton(
            tooltip: t.backProjects,
            onPressed: locked ? null : goHome,
            icon: const BackButtonIcon(),
          )
        else
          const Padding(padding: EdgeInsets.all(8), child: BrandMark()),
        Expanded(
          child: Text(
            home ? t.appTitle : name ?? t.studio,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: type.titleMedium,
          ),
        ),
        if (!home)
          IconButton(
            key: const ValueKey('review-export'),
            tooltip: t.exportSummary,
            onPressed: () => select(_Tool.export),
            icon: const MxIcon('export'),
          ),
        IconButton(
          key: const ValueKey('settings'),
          tooltip: t.settings,
          onPressed: exporting ? null : settings,
          icon: const MxIcon('settings'),
        ),
      ],
    );
    Widget metadata() => Wrap(
      spacing: 16,
      runSpacing: 8,
      children: [
        for (final item in [
          (t.resolution, "${data['w']} × ${data['h']}"),
          (t.rate, data['fps'] == null ? t.unknownRate : "${data['fps']} fps"),
          (t.rotation, "${data['rot']}°"),
          (t.sound, data['audio'] == true ? t.withAudio : t.silent),
        ])
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item.$1, style: type.labelSmall?.copyWith(color: Mx.muted)),
              Text(_isolate(item.$2), style: type.titleMedium),
            ],
          ),
      ],
    );
    void setEdge(TextEditingController ctrl) {
      setState(() {
        ctrl.text = ms(pos);
        committed = false;
      });
    }

    Widget inspector() {
      final dirty = start.text != ms(a) || end.text != ms(b);
      Widget field(TextEditingController c, String label) => TextField(
        controller: c,
        enabled: !locked,
        onChanged: (_) => setState(() => committed = false),
        textDirection: TextDirection.ltr,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: InputDecoration(labelText: label),
      );
      return SingleChildScrollView(
        key: ValueKey(tool),
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(switch (tool) {
              _Tool.source => t.reviewFile,
              _Tool.trim => t.properties,
              _Tool.export => t.exportSummary,
            }, style: type.titleMedium),
            Text(_isolate(name), style: type.bodyMedium),
            const Divider(height: 16),
            if (tool == _Tool.source) ...[
              metadata(),
              const SizedBox(height: 12),
              Text(t.replaceHint),
              OutlinedButton.icon(
                onPressed: locked ? null : openSource,
                icon: const MxIcon('import'),
                label: Text(t.replace),
              ),
            ],
            if (tool == _Tool.trim) ...[
              Text(
                dirty ? t.draft : t.saved,
                style: type.labelLarge?.copyWith(
                  color: dirty ? Mx.lightGold : Mx.muted,
                ),
              ),
              Text(t.rangeTip),
              Wrap(
                spacing: 8,
                children: [
                  TextButton(
                    onPressed: locked ? null : () => setEdge(start),
                    child: Text(t.startHere),
                  ),
                  TextButton(
                    onPressed: locked ? null : () => setEdge(end),
                    child: Text(t.endHere),
                  ),
                ],
              ),
              field(start, t.startMs),
              const SizedBox(height: 12),
              field(end, t.endMs),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  FilledButton.icon(
                    onPressed: locked || !dirty
                        ? null
                        : () => trim(readUs(start.text), readUs(end.text)),
                    icon: const MxIcon('save'),
                    label: Text(t.applyRange),
                  ),
                  TextButton(
                    onPressed: locked || !dirty
                        ? null
                        : () => setState(() {
                            resetDraft();
                            committed = false;
                          }),
                    child: Text(t.resetDraft),
                  ),
                ],
              ),
              if (committed && !dirty)
                Text(t.rangeSaved, style: const TextStyle(color: Mx.success)),
            ],
            if (tool == _Tool.export) ...[
              Text(t.saved),
              Text(
                range,
                textDirection: TextDirection.ltr,
                style: type.titleMedium,
              ),
              Text(
                t.selectedTime(
                  t.selection,
                  '\u2066${((b - a) / 1e6).toStringAsFixed(3)}\u2069',
                ),
              ),
              const SizedBox(height: 8),
              metadata(),
              Text(t.exportHint),
              if (dirty)
                Text(t.draft, style: const TextStyle(color: Mx.lightGold)),
              if (!exporting)
                FilledButton.icon(
                  onPressed: locked || dirty ? null : () => run('export'),
                  icon: const MxIcon('export'),
                  label: Text(t.exportVideo),
                ),
              if (dirty)
                TextButton(
                  onPressed: () => select(_Tool.trim),
                  child: Text(t.trimTool),
                ),
              if (exporting) ...[
                Text(stage == 'publishing' ? t.publishing : t.exporting),
                LinearProgressIndicator(
                  value: data['percent'] == null ? null : data['percent'] / 100,
                ),
                TextButton(
                  onPressed: busy ? null : () => run('cancel'),
                  child: Text(t.cancelExport),
                ),
              ],
            ],
            if (note.isNotEmpty)
              Semantics(
                liveRegion: true,
                child: Text(
                  note,
                  style: TextStyle(
                    color: stage == 'done' && error.isEmpty
                        ? Mx.success
                        : Mx.muted,
                  ),
                ),
              ),
          ],
        ),
      );
    }

    Widget rail() => SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final item in [
            (_Tool.source, 'video', t.source),
            (_Tool.trim, 'trim', t.trimTool),
            (_Tool.export, 'export', t.deliver),
          ])
            TextButton.icon(
              key: ValueKey('tool-${item.$1.name}'),
              style: TextButton.styleFrom(
                minimumSize: const Size(48, 48),
                foregroundColor: tool == item.$1 ? Mx.lightGold : Mx.muted,
                backgroundColor: tool == item.$1 ? Mx.selected : null,
              ),
              onPressed: exporting && item.$1 != _Tool.export
                  ? null
                  : () => select(item.$1),
              icon: MxIcon(item.$2),
              label: Text(item.$3),
            ),
        ],
      ),
    );
    Widget monitor() => ColoredBox(
      color: Colors.black,
      child: const AndroidView(
        key: ValueKey('monitor'),
        viewType: 'max_editor/preview',
      ),
    );
    Widget transport() => Row(
      children: [
        IconButton(
          tooltip: data['playing'] == true ? t.pause : t.play,
          onPressed: locked ? null : () => run('play'),
          icon: MxIcon(data['playing'] == true ? 'pause' : 'play'),
        ),
        Expanded(
          child: FittedBox(
            fit: BoxFit.scaleDown,
            alignment: AlignmentDirectional.centerStart,
            child: Text(
              [
                timecode(drag?.round() ?? pos),
                timecode(d ?? 0),
              ].join('   /   '),
              textDirection: TextDirection.ltr,
              style: type.titleMedium,
            ),
          ),
        ),
        const SizedBox(width: 8),
      ],
    );
    Widget timeline() => SourceTimeline(
      duration: d!,
      position: drag ?? pos.toDouble(),
      start: a,
      end: b,
      name: name ?? t.source,
      selected: tool == _Tool.trim,
      onSelect: () => select(_Tool.trim),
      onChanged: locked ? null : (v) => setState(() => drag = v),
      onEnd: (v) {
        setState(() => drag = null);
        run('seek', {'us': v.round()});
      },
    );
    Widget workspace() => LayoutBuilder(
      builder: (ctx, box) {
        final wide =
            box.maxWidth >= 840 ||
            (box.maxWidth >= 600 && box.maxWidth > box.maxHeight * 1.25);
        if (box.maxWidth >= 1000 && box.maxHeight >= 480) {
          return Column(
            key: const ValueKey('panes'),
            children: [
              Expanded(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SizedBox(
                      width: 180,
                      child: ListView(
                        padding: const EdgeInsets.all(12),
                        children: [
                          Text(t.source, style: type.titleMedium),
                          const Divider(),
                          const MxIcon('video'),
                          Text(_isolate(name)),
                          Text(timecode(d!)),
                          TextButton.icon(
                            onPressed: locked ? null : openSource,
                            icon: const MxIcon('import'),
                            label: Text(t.replace),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: Column(
                        children: [
                          Expanded(child: monitor()),
                          transport(),
                        ],
                      ),
                    ),
                    SizedBox(
                      width: box.maxWidth * .32,
                      child: Column(
                        children: [
                          rail(),
                          Expanded(child: inspector()),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              timeline(),
            ],
          );
        }
        if (wide) {
          return Row(
            key: const ValueKey('panes'),
            children: [
              Expanded(
                flex: 3,
                child: Column(
                  children: [
                    Expanded(child: monitor()),
                    transport(),
                  ],
                ),
              ),
              const VerticalDivider(width: 1),
              Expanded(
                flex: 2,
                child: Column(
                  children: [
                    rail(),
                    Expanded(
                      child: ListView(
                        children: [
                          timeline(),
                          SizedBox(
                            height: (box.maxHeight * .65)
                                .clamp(180, 650)
                                .toDouble(),
                            child: inspector(),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        }
        // Keep the monitor mounted while switching tools; shrink it for keyboard/large type.
        return Column(
          children: [
            SizedBox(
              width: double.infinity,
              height: box.maxHeight * (box.maxHeight < 420 ? 0.18 : 0.26),
              child: monitor(),
            ),
            if (box.maxHeight > 165) transport(),
            Expanded(
              child: LayoutBuilder(
                builder: (_, inner) {
                  if (inner.maxHeight < 320 ||
                      MediaQuery.textScalerOf(ctx).scale(1) > 1.5) {
                    return ListView(
                      children: [
                        rail(),
                        timeline(),
                        SizedBox(
                          height: inner.maxHeight.clamp(220, 600).toDouble(),
                          child: inspector(),
                        ),
                      ],
                    );
                  }
                  return Column(
                    children: [
                      rail(),
                      timeline(),
                      Expanded(child: inspector()),
                    ],
                  );
                },
              ),
            ),
          ],
        );
      },
    );
    return PopScope(
      canPop: home,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && !home) goHome();
      },
      child: Scaffold(
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: header,
              ),
              const Divider(height: 1, color: Mx.line),
              Expanded(
                child: home
                    ? ProjectLibrary(
                        name: name,
                        range: range,
                        status: note,
                        onImport: locked ? null : openSource,
                        onResume: d == null
                            ? null
                            : () {
                                setState(() {
                                  library = false;
                                  tool = _Tool.source;
                                });
                              },
                      )
                    : workspace(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
