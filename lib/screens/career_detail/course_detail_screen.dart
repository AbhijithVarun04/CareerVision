import 'package:flutter/material.dart';
import '../../config/constants.dart';
import '../../widgets/app_scaffold.dart';

class CourseDetailScreen extends StatelessWidget {
  const CourseDetailScreen({super.key});

  static List<String> _stringList(dynamic v) =>
      v is List ? v.whereType<String>().toList() : <String>[];

  void _openColleges(
      BuildContext context,
      Map<String, dynamic> career,
      String? course,
      ) {
    Navigator.pushNamed(
      context,
      Routes.collegeFinder,
      arguments: {'career': career, 'course': course},
    );
  }

  @override
  Widget build(BuildContext context) {
    final args = ModalRoute.of(context)?.settings.arguments;

    if (args is! Map) {
      return const AppScaffold(
        title: 'Course Detail',
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
    final name = (career['career_name'] ?? 'this career').toString();
    final degrees = _stringList(career['degrees']);
    final certifications = _stringList(career['certifications']);

    return AppScaffold(
      title: 'Course Detail',
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Courses for $name', style: theme.textTheme.headlineSmall),
            const SizedBox(height: 8),
            const Text(
              'These are the degrees usually asked for in this field. '
                  'Pick one to see colleges in Chennai.',
            ),
            const SizedBox(height: 16),
            if (degrees.isEmpty) ...[
              const Text('We could not find specific degrees for this career.'),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => _openColleges(context, career, null),
                  child: const Text('Find Chennai Colleges'),
                ),
              ),
            ] else
              ...degrees.map(
                    (d) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(d),
                    subtitle: const Text('Find Chennai colleges'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => _openColleges(context, career, d),
                  ),
                ),
              ),
            const SizedBox(height: 16),
            Text(
              'Certifications that can help',
              style: theme.textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            if (certifications.isEmpty)
              const Text('No certifications found')
            else
              ...certifications.map((c) => Text('• $c')),
          ],
        ),
      ),
    );
  }
}