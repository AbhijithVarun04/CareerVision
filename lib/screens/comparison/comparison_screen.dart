import 'package:flutter/material.dart';
import '../../widgets/app_scaffold.dart';
import 'past_vs_current_view.dart';

String _pct(dynamic v) => '${((v is num ? v.toDouble() : 0.0) * 100).round()}%';

// Starting salary in lakhs per annum, as produced by the synthesizer.
String _salary(dynamic v) {
  if (v is! num) return 'Not available';
  final s = v.toDouble().toStringAsFixed(2).replaceFirst(RegExp(r'\.?0+$'), '');
  return '₹$s LPA';
}

String _demand(dynamic v) {
  switch (v) {
    case 'very_high':
      return 'Very high';
    case 'high':
      return 'High';
    case 'moderate':
      return 'Moderate';
    case 'low':
      return 'Low';
    default:
      return 'Unknown';
  }
}

String _degrees(dynamic v) {
  final list = v is List
      ? v.whereType<String>().where((d) => d.trim().isNotEmpty).toList()
      : <String>[];
  if (list.isEmpty) return 'Not available';
  return list.map((d) => '• $d').join('\n');
}

class ComparisonScreen extends StatelessWidget {
  final bool embedded;
  const ComparisonScreen({super.key, this.embedded = false});

  @override
  Widget build(BuildContext context) {
    if (embedded) {
      return const SafeArea(child: PastVsCurrentView());
    }

    final args = ModalRoute.of(context)?.settings.arguments;
    final careers = <Map<String, dynamic>>[];
    if (args is Map && args['careers'] is List) {
      for (final c in args['careers'] as List) {
        if (c is Map) careers.add(Map<String, dynamic>.from(c));
      }
    }

    return AppScaffold(
      title: 'Comparison',
      body: careers.length < 2
          ? const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'Pick two or three careers from your recommendations to compare them.',
            textAlign: TextAlign.center,
          ),
        ),
      )
          : _ComparisonTable(careers: careers),
    );
  }
}

class _ComparisonTable extends StatelessWidget {
  const _ComparisonTable({required this.careers});

  final List<Map<String, dynamic>> careers;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final anyLimited = careers.any((c) => c['data_quality'] != 'good');

    Widget cell(String text, {TextStyle? style}) => Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
      child: Text(text, style: style ?? theme.textTheme.bodySmall),
    );

    TableRow row(String label, List<String> values, {bool header = false}) {
      final valueStyle =
      header ? theme.textTheme.titleSmall : theme.textTheme.bodySmall;
      return TableRow(children: [
        cell(label,
            style: theme.textTheme.bodySmall
                ?.copyWith(fontWeight: FontWeight.bold)),
        for (final v in values) cell(v, style: valueStyle),
      ]);
    }

    List<String> col(String Function(Map<String, dynamic>) f) =>
        careers.map(f).toList();

    final widths = <int, TableColumnWidth>{0: const FixedColumnWidth(84)};
    for (var i = 0; i < careers.length; i++) {
      widths[i + 1] = const FlexColumnWidth();
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Table(
            columnWidths: widths,
            defaultVerticalAlignment: TableCellVerticalAlignment.top,
            border: TableBorder(
              horizontalInside: BorderSide(color: theme.dividerColor),
            ),
            children: [
              row('', col((c) => '${c['career_name'] ?? 'Career'}'),
                  header: true),
              row('Overall match', col((c) => _pct(c['final_score']))),
              row('Interest fit', col((c) => _pct(c['fit_score']))),
              row('Starting salary', col((c) => _salary(c['median_salary_lpa']))),
              row('Hiring demand', col((c) => _demand(c['demand_level']))),
              row('Degrees', col((c) => _degrees(c['degrees']))),
              row('Data',
                  col((c) => c['data_quality'] == 'good' ? 'Good' : 'Limited')),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            'Starting salary is the typical entry-level figure in lakhs per annum (LPA).',
            style: theme.textTheme.bodySmall,
          ),
          if (anyLimited) ...[
            const SizedBox(height: 8),
            Text(
              'Some careers have limited data, so their figures may be incomplete.',
              style: theme.textTheme.bodySmall,
            ),
          ],
        ],
      ),
    );
  }
}