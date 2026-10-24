import 'package:flutter/material.dart';
import '../../config/constants.dart';
import '../../widgets/app_scaffold.dart';

class CareerDetailScreen extends StatelessWidget {
  const CareerDetailScreen({super.key});

  static const _demandLabels = {
    'very_high': 'Very high',
    'high': 'High',
    'moderate': 'Moderate',
    'low': 'Low',
    'unknown': 'Not confirmed',
  };

  static String _percent(dynamic v) =>
      v is num ? '${(v * 100).round()}%' : '-';

  static List<String> _stringList(dynamic v) =>
      v is List ? v.whereType<String>().toList() : <String>[];

  @override
  Widget build(BuildContext context) {
    final args = ModalRoute.of(context)?.settings.arguments;

    if (args is! Map) {
      return const AppScaffold(
        title: 'Career Detail',
        body: Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'We could not find this career. Please go back and try again.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }

    final career = Map<String, dynamic>.from(args);
    final theme = Theme.of(context);

    final name = (career['career_name'] ?? 'Career').toString();
    final rank = career['rank'];
    final reasoning = (career['reasoning_text'] ?? '').toString();
    final salary = career['median_salary_lpa'];
    final demandLevel = (career['demand_level'] ?? 'unknown').toString();
    final chennaiNote = career['chennai_demand_note'];
    final degrees = _stringList(career['degrees']);
    final certifications = _stringList(career['certifications']);
    final limitedData = career['data_quality'] != null &&
        career['data_quality'] != 'good';

    return AppScaffold(
      title: 'Career Detail',
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              rank is num ? '#${rank.toInt()}  $name' : name,
              style: theme.textTheme.headlineSmall,
            ),
            const SizedBox(height: 4),
            Text(
              'Overall match: ${_percent(career['final_score'])}',
              style: theme.textTheme.titleMedium,
            ),
            if (limitedData) ...[
              const SizedBox(height: 8),
              const Chip(label: Text('Limited data')),
            ],
            const SizedBox(height: 16),
            _ScoreBar(label: 'Interest fit', value: career['fit_score']),
            _ScoreBar(label: 'Salary', value: career['salary_score']),
            _ScoreBar(label: 'Demand', value: career['demand_score']),
            if (reasoning.isNotEmpty) ...[
              const SizedBox(height: 16),
              _SectionTitle('Why this career'),
              Text(reasoning),
            ],
            const SizedBox(height: 16),
            _SectionTitle('Starting salary'),
            Text(
              salary is num
                  ? 'About ₹${salary.toStringAsFixed(salary % 1 == 0 ? 0 : 1)} lakh per year'
                  : 'No reliable figure found',
            ),
            const SizedBox(height: 16),
            _SectionTitle('Hiring demand'),
            Text(_demandLabels[demandLevel] ?? 'Not confirmed'),
            if (chennaiNote is String && chennaiNote.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(chennaiNote),
            ],
            const SizedBox(height: 16),
            _SectionTitle('Degrees'),
            if (degrees.isEmpty)
              const Text('No degree information found')
            else
              ...degrees.map((d) => Text('• $d')),
            const SizedBox(height: 16),
            _SectionTitle('Certifications'),
            if (certifications.isEmpty)
              const Text('No certifications found')
            else
              ...certifications.map((c) => Text('• $c')),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pushNamed(
                  context,
                  Routes.courseDetail,
                  arguments: career,
                ),
                child: const Text('View Course Detail'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 4),
    child: Text(text, style: Theme.of(context).textTheme.titleMedium),
  );
}

class _ScoreBar extends StatelessWidget {
  const _ScoreBar({required this.label, required this.value});
  final String label;
  final dynamic value;

  @override
  Widget build(BuildContext context) {
    final v = value is num ? (value as num).toDouble().clamp(0.0, 1.0) : 0.0;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('$label: ${value is num ? '${(v * 100).round()}%' : '-'}'),
          const SizedBox(height: 4),
          LinearProgressIndicator(value: v),
        ],
      ),
    );
  }
}