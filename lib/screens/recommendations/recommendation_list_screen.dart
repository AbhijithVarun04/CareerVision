import 'package:flutter/material.dart';

import '../../config/constants.dart';
import '../../widgets/app_scaffold.dart';

double _num(dynamic v) => v is num ? v.toDouble() : 0.0;

String _pct(dynamic v) => '${(_num(v) * 100).round()}%';

class RecommendationListScreen extends StatelessWidget {
  const RecommendationListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // Set by ProcessingScreen: the full submitAssessment response.
    // TODO(auth): once login exists, this same data can also be loaded from
    // students/{uid}/attempts/{attemptId} (used later by Attempt History).
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
          : ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: items.length + 1,
        itemBuilder: (context, i) {
          if (i == 0) {
            return _Header(
              summary: summary is String ? summary : null,
              weights: weights is Map ? Map<String, dynamic>.from(weights) : null,
            );
          }
          return _RecommendationCard(item: items[i - 1]);
        },
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
  const _RecommendationCard({required this.item});

  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final limited = item['data_quality'] != 'good';
    final reasoning = item['reasoning_text'];

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        // Career Detail is still a placeholder; it will read this map later.
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
              ]
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