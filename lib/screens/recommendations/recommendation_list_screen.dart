import 'dart:async';

import 'package:flutter/material.dart';

import '../../config/constants.dart';
import '../../services/comparison_service.dart';
import '../../widgets/app_scaffold.dart';

const int _minCompare = 2;
const int _maxCompare = 3;

double _num(dynamic v) => v is num ? v.toDouble() : 0.0;

String _pct(dynamic v) => '${(_num(v) * 100).round()}%';

// The Firestore recommendation document id. Null means the item cannot be
// selected for comparison (there is no name-based fallback on purpose).
String? _idOf(Map<String, dynamic> item) {
  final id = item['id'];
  return id is String && id.isNotEmpty ? id : null;
}

class RecommendationListScreen extends StatefulWidget {
  const RecommendationListScreen({super.key});

  @override
  State<RecommendationListScreen> createState() =>
      _RecommendationListScreenState();
}

class _RecommendationListScreenState extends State<RecommendationListScreen> {
  final Set<String> _selected = {};

  void _toggle(String id, bool? on) {
    setState(() {
      if (on == true) {
        if (_selected.length < _maxCompare) _selected.add(id);
      } else {
        _selected.remove(id);
      }
    });
  }

  void _compare(List<Map<String, dynamic>> items, String? attemptId) {
    final chosen = items.where((e) {
      final id = _idOf(e);
      return id != null && _selected.contains(id);
    }).toList();
    if (chosen.length < _minCompare || chosen.length > _maxCompare) return;

    // Captured now: the messenger belongs to the app, so the message still
    // shows on the comparison screen after we navigate.
    final messenger = ScaffoldMessenger.of(context);
    unawaited(
      ComparisonService()
          .saveSelection(
        attemptId: attemptId,
        recommendationIds: chosen.map((e) => _idOf(e)!).toList(),
      )
          .catchError((Object e) {
        messenger.showSnackBar(SnackBar(
          content: Text(e is ComparisonSaveException
              ? e.message
              : 'Could not save this comparison.'),
          duration: const Duration(seconds: 6),
        ));
      }),
    );

    Navigator.pushNamed(context, Routes.comparison, arguments: {
      'attemptId': attemptId,
      'careers': chosen,
    });
  }

  @override
  Widget build(BuildContext context) {
    // Either the submitAssessment response (fresh run) or the same shape
    // rebuilt from Firestore by Attempt History.
    final args = ModalRoute.of(context)?.settings.arguments;
    final data = args is Map ? Map<String, dynamic>.from(args) : null;

    final items = <Map<String, dynamic>>[];
    final raw = data?['recommendations'];
    if (raw is List) {
      for (final r in raw) {
        if (r is Map) items.add(Map<String, dynamic>.from(r));
      }
    }
    items.sort((a, b) => _num(a['rank']).compareTo(_num(b['rank'])));

    final summary = data?['summary'];
    final weights = data?['weights'];
    final rawAttemptId = data?['attemptId'];
    final attemptId = rawAttemptId is String ? rawAttemptId : null;

    return AppScaffold(
      title: 'Recommendations',
      body: items.isEmpty
          ? const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'No recommendations to show yet. Please take the assessment again.',
            textAlign: TextAlign.center,
          ),
        ),
      )
          : Column(
        children: [
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: items.length + 1,
              itemBuilder: (context, i) {
                if (i == 0) {
                  return _Header(
                    summary: summary is String ? summary : null,
                    weights: weights is Map
                        ? Map<String, dynamic>.from(weights)
                        : null,
                  );
                }
                final item = items[i - 1];
                final id = _idOf(item);
                final isSelected = id != null && _selected.contains(id);
                return _RecommendationCard(
                  item: item,
                  selected: isSelected,
                  canSelect: id != null &&
                      (isSelected || _selected.length < _maxCompare),
                  onSelect: (on) {
                    if (id != null) _toggle(id, on);
                  },
                );
              },
            ),
          ),
          _CompareBar(
            count: _selected.length,
            onPressed: _selected.length >= _minCompare &&
                _selected.length <= _maxCompare
                ? () => _compare(items, attemptId)
                : null,
          ),
        ],
      ),
    );
  }
}

class _CompareBar extends StatelessWidget {
  const _CompareBar({required this.count, required this.onPressed});

  final int count;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final label = count == 0
        ? 'Tick 2 or 3 careers to compare'
        : count == 1
        ? 'Tick 1 more to compare'
        : 'Compare $count careers';
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: SizedBox(
          width: double.infinity,
          child: FilledButton(onPressed: onPressed, child: Text(label)),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({this.summary, this.weights});

  final String? summary;
  final Map<String, dynamic>? weights;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final w = weights;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Your top career matches', style: theme.textTheme.titleLarge),
          if (summary != null && summary!.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(summary!, style: theme.textTheme.bodyMedium),
          ],
          if (w != null) ...[
            const SizedBox(height: 8),
            Text(
              'Overall = the three scores below, weighted by your priorities: '
                  'Interest ${_pct(w['interest'])} · '
                  'Salary ${_pct(w['salary'])} · '
                  'Demand ${_pct(w['demand'])}.',
              style: theme.textTheme.bodySmall,
            ),
          ],
        ],
      ),
    );
  }
}

class _RecommendationCard extends StatelessWidget {
  const _RecommendationCard({
    required this.item,
    required this.selected,
    required this.canSelect,
    required this.onSelect,
  });

  final Map<String, dynamic> item;
  final bool selected;
  final bool canSelect;
  final ValueChanged<bool?> onSelect;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final limited = item['data_quality'] != 'good';
    final reasoning = item['reasoning_text'];

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => Navigator.pushNamed(
          context,
          Routes.careerDetail,
          arguments: item,
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CircleAvatar(
                    radius: 16,
                    child: Text('${_num(item['rank']).round()}'),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      '${item['career_name'] ?? 'Career'}',
                      style: theme.textTheme.titleMedium,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        _pct(item['final_score']),
                        style: theme.textTheme.titleMedium,
                      ),
                      Text('overall', style: theme.textTheme.bodySmall),
                    ],
                  ),
                ],
              ),
              if (limited) ...[
                const SizedBox(height: 8),
                Chip(
                  avatar: const Icon(Icons.info_outline, size: 16),
                  label: const Text('Limited data'),
                  visualDensity: VisualDensity.compact,
                ),
              ],
              const SizedBox(height: 12),
              _ScoreBar(label: 'Interest fit', value: _num(item['fit_score'])),
              _ScoreBar(label: 'Salary', value: _num(item['salary_score'])),
              _ScoreBar(label: 'Demand', value: _num(item['demand_score'])),
              if (reasoning is String && reasoning.trim().isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(reasoning, style: theme.textTheme.bodyMedium),
              ],
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                controlAffinity: ListTileControlAffinity.leading,
                value: selected,
                onChanged: canSelect ? onSelect : null,
                title: const Text('Add to comparison'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ScoreBar extends StatelessWidget {
  const _ScoreBar({required this.label, required this.value});

  final String label;
  final double value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          SizedBox(
            width: 88,
            child: Text(label, style: theme.textTheme.bodySmall),
          ),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: value.clamp(0.0, 1.0),
                minHeight: 8,
              ),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 40,
            child: Text(
              _pct(value),
              style: theme.textTheme.bodySmall,
              textAlign: TextAlign.end,
            ),
          ),
        ],
      ),
    );
  }
}