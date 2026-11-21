import 'package:flutter/material.dart';
import '../../app/design/max_theme.dart';
import '../../l10n/generated/app_localizations.dart';

/// The native repository has one checkpoint, never an invented project list.
class ProjectLibrary extends StatelessWidget {
  const ProjectLibrary({
    super.key,
    required this.name,
    required this.range,
    required this.status,
    required this.onImport,
    required this.onResume,
  });
  final String? name;
  final String range, status;
  final VoidCallback? onImport, onResume;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context), type = Theme.of(context).textTheme;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 32),
      children: [
        Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 760),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  t.local,
                  style: type.labelLarge?.copyWith(color: Mx.muted),
                ),
                Text(
                  t.projects,
                  style: type.headlineLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                MxPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const MxIcon('video'),
                      const SizedBox(height: 12),
                      Text(t.newProject, style: type.titleLarge),
                      Text(t.emptyHint),
                      const SizedBox(height: 16),
                      FilledButton.icon(
                        key: const ValueKey('import'),
                        onPressed: onImport,
                        icon: const MxIcon('import'),
                        label: Text(t.importVideo),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                Text(t.recent, style: type.titleMedium),
                const SizedBox(height: 8),
                MxPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name ?? t.noProject, style: type.titleMedium),
                      Text(name == null ? t.noHint : range),
                      if (onResume != null)
                        OutlinedButton.icon(
                          key: const ValueKey('resume'),
                          onPressed: onResume,
                          icon: const MxIcon('play'),
                          label: Text(t.resume),
                        ),
                    ],
                  ),
                ),
                if (status.isNotEmpty)
                  Text(status, style: const TextStyle(color: Mx.error)),
                const SizedBox(height: 24),
                Text(t.workflow, style: type.titleMedium),
                const Divider(),
                Wrap(
                  spacing: 16,
                  runSpacing: 8,
                  children: [
                    for (final entry in [
                      ('01', t.importStep),
                      ('02', t.rangeStep),
                      ('03', t.deliverStep),
                    ])
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            entry.$1,
                            style: const TextStyle(color: Mx.muted),
                          ),
                          const SizedBox(width: 8),
                          Flexible(child: Text(entry.$2)),
                        ],
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
