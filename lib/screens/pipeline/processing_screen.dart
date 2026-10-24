import 'dart:async';
import 'dart:convert';

import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';

import '../../config/constants.dart';
import '../../models/questionnaire_response.dart';
import '../../widgets/app_scaffold.dart';

class ProcessingScreen extends StatefulWidget {
  const ProcessingScreen({super.key});

  @override
  State<ProcessingScreen> createState() => _ProcessingScreenState();
}

class _ProcessingScreenState extends State<ProcessingScreen> {
  static const _region = 'asia-south1';
  static const _callableName = 'submitAssessment';
  // Backend limit is 300 s; worst case is ~250 s.
  static const _timeout = Duration(seconds: 270);

  // Cosmetic only: shown by elapsed time, not real stage reporting.
  static const _messages = [
    'Understanding your answers...',
    'Finding careers that could suit you...',
    'Checking current salary and demand...',
    'Scoring and ranking your matches...',
    'Almost there...',
  ];

  QuestionnaireResponse? _response;
  Timer? _ticker;
  int _elapsedSeconds = 0;
  bool _started = false;
  String? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;

    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is QuestionnaireResponse) {
      _response = args;
      _start();
    } else {
      _error = 'We could not find your answers. Please go back and try again.';
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  void _start() {
    _error = null;
    _elapsedSeconds = 0;
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _elapsedSeconds++);
    });
    _run();
  }

  Future<void> _run() async {
    try {
      final callable = FirebaseFunctions.instanceFor(region: _region)
          .httpsCallable(
        _callableName,
        options: HttpsCallableOptions(timeout: _timeout),
      );
      final result = await callable.call({
        'questionnaire': _response!.toJson(),
      });

      // JSON round trip turns the platform maps into clean Map<String, dynamic>.
      final data = jsonDecode(jsonEncode(result.data)) as Map<String, dynamic>;

      if (!mounted) return;
      _ticker?.cancel();
      // Clear back to Home so Back from the results does not land on the
      // half-filled questionnaire (stack becomes Home, Recommendations).
      Navigator.pushNamedAndRemoveUntil(
        context,
        Routes.recommendations,
        ModalRoute.withName(Routes.home),
        arguments: data,
      );
    } on FirebaseFunctionsException catch (e) {
      debugPrint('submitAssessment failed: ${e.code} | ${e.message}');
      _fail(_messageFor(e));
    } catch (e) {
      debugPrint('submitAssessment unexpected error: $e');
      _fail('Something went wrong. Please try again.');
    }
  }

  void _fail(String message) {
    _ticker?.cancel();
    if (!mounted) return;
    setState(() => _error = message);
  }

  String _messageFor(FirebaseFunctionsException e) {
    switch (e.code) {
      case 'invalid-argument':
        return 'Some of your answers look invalid. Please go back and check them.';
      case 'deadline-exceeded':
        return 'This is taking longer than expected. Please try again.';
      case 'unavailable':
        return 'We could not reach the server. Check your connection and try again.';
      case 'unauthenticated':
      // Auth plugs in later (REQUIRE_AUTH = true on the backend).
        return 'Please sign in to continue.';
      default:
        return 'We could not generate recommendations right now. Please try again.';
    }
  }

  @override
  Widget build(BuildContext context) {
    final failed = _error != null;
    return PopScope(
      // Block back while the request is running; allow it once it has failed.
      canPop: failed,
      child: AppScaffold(
        title: 'Processing',
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: failed ? _buildError(context) : _buildLoading(context),
          ),
        ),
      ),
    );
  }

  Widget _buildLoading(BuildContext context) {
    final index = (_elapsedSeconds ~/ 12).clamp(0, _messages.length - 1);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const CircularProgressIndicator(),
        const SizedBox(height: 24),
        Text(
          _messages[index],
          style: Theme.of(context).textTheme.titleMedium,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          'This usually takes 1 to 2 minutes. Please keep the app open.',
          style: Theme.of(context).textTheme.bodySmall,
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildError(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.error_outline, size: 48),
        const SizedBox(height: 16),
        Text(
          _error!,
          style: Theme.of(context).textTheme.bodyLarge,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            OutlinedButton(
              onPressed: () => Navigator.maybePop(context),
              child: const Text('Go back'),
            ),
            const SizedBox(width: 12),
            if (_response != null)
              ElevatedButton(
                onPressed: () => setState(_start),
                child: const Text('Try again'),
              ),
          ],
        ),
      ],
    );
  }
}