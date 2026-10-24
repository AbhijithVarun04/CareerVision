import 'dart:convert';

import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import '../../widgets/app_scaffold.dart';

class CollegeFinderScreen extends StatefulWidget {
  const CollegeFinderScreen({super.key});

  @override
  State<CollegeFinderScreen> createState() => _CollegeFinderScreenState();
}

class _College {
  const _College(this.name, this.site);
  final String name;
  final String? site;
}

class _CollegeFinderScreenState extends State<CollegeFinderScreen> {
  bool _started = false;
  bool _badArgs = false;
  bool _loading = true;
  String? _error;
  List<_College> _colleges = const [];
  String? _course;
  String? _careerName;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;

    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is Map) {
      final course = args['course'];
      final career = args['career'];
      _course = course is String && course.trim().isNotEmpty ? course.trim() : null;
      _careerName = career is Map && career['career_name'] is String
          ? (career['career_name'] as String).trim()
          : null;
    }
    if (_course == null && (_careerName == null || _careerName!.isEmpty)) {
      _badArgs = true;
      _loading = false;
      return;
    }
    _load();
  }

  static String? _site(String? url) {
    if (url == null) return null;
    final host = Uri.tryParse(url)?.host;
    if (host == null || host.isEmpty) return null;
    return host.startsWith('www.') ? host.substring(4) : host;
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final callable = FirebaseFunctions.instanceFor(region: 'asia-south1')
          .httpsCallable(
        'findColleges',
        options: HttpsCallableOptions(timeout: const Duration(seconds: 60)),
      );
      final result = await callable.call({
        'course': _course,
        'careerName': _careerName,
      });
      final data = jsonDecode(jsonEncode(result.data));
      final raw = data is Map && data['colleges'] is List
          ? data['colleges'] as List
          : const [];
      final colleges = <_College>[];
      for (final item in raw) {
        if (item is Map && item['name'] is String && (item['name'] as String).isNotEmpty) {
          colleges.add(_College(
            item['name'] as String,
            _site(item['url'] is String ? item['url'] as String : null),
          ));
        }
      }
      if (!mounted) return;
      setState(() {
        _colleges = colleges;
        _loading = false;
      });
    } on FirebaseFunctionsException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = switch (e.code) {
          'deadline-exceeded' || 'unavailable' =>
          'The search took too long. Check your connection and try again.',
          'invalid-argument' => 'We could not understand this course. Please go back and try again.',
          _ => 'We could not load colleges right now. Please try again.',
        };
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'We could not load colleges right now. Please try again.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (_badArgs) {
      return const AppScaffold(
        title: 'Chennai College Finder',
        body: Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'We could not find which course to search. Please go back and try again.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }

    final subject = _course ?? _careerName ?? 'this field';

    Widget content;
    if (_loading) {
      content = const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Searching for colleges in Chennai...'),
          ],
        ),
      );
    } else if (_error != null) {
      content = Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: _load, child: const Text('Try again')),
            ],
          ),
        ),
      );
    } else if (_colleges.isEmpty) {
      content = Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'We could not find Chennai colleges for this course in our search. '
                    'You can try again, or go back and pick a different course.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: _load, child: const Text('Search again')),
            ],
          ),
        ),
      );
    } else {
      content = ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Colleges for $subject', style: theme.textTheme.headlineSmall),
          const SizedBox(height: 4),
          const Text(
            'Found through a web search. Please check each college\'s official '
                'website before you apply.',
          ),
          const SizedBox(height: 12),
          ..._colleges.map(
                (c) => Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                leading: const Icon(Icons.school_outlined),
                title: Text(c.name),
                subtitle: c.site == null ? null : Text('Source: ${c.site}'),
              ),
            ),
          ),
        ],
      );
    }

    return AppScaffold(title: 'Chennai College Finder', body: content);
  }
}