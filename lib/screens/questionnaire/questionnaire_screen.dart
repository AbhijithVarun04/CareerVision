import 'package:flutter/material.dart';
import '../../config/constants.dart';
import '../../state/questionnaire_controller.dart';
import '../../widgets/app_scaffold.dart';
import 'interests_step.dart';
import 'hobbies_step.dart';
import 'strengths_step.dart';
import 'work_style_step.dart';
import 'priority_weights_step.dart';

class QuestionnaireScreen extends StatefulWidget {
  const QuestionnaireScreen({super.key});

  @override
  State<QuestionnaireScreen> createState() => _QuestionnaireScreenState();
}

class _QuestionnaireScreenState extends State<QuestionnaireScreen> {
  final _controller = QuestionnaireController();
  final _pageController = PageController();
  int _stepIndex = 0;
  static const _totalSteps = 5;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _controller.dispose();
    _pageController.dispose();
    super.dispose();
  }

  void _goNext() {
    if (_stepIndex == 0 && _controller.response.interests.isEmpty) {
      _showWarning('Please select at least one interest.');
      return;
    }
    // step 1 = hobbies, optional — no validation
    if (_stepIndex == 2 && _controller.response.strengths.isEmpty) {
      _showWarning('Please select at least one strength.');
      return;
    }
    if (_stepIndex == 3 && _controller.response.workStyles.isEmpty) {
      _showWarning('Please select at least one work style.');
      return;
    }

    if (_stepIndex < _totalSteps - 1) {
      setState(() => _stepIndex++);
      _pageController.animateToPage(
        _stepIndex,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeInOut,
      );
    } else {
      Navigator.pushNamed(
        context,
        Routes.processing,
        arguments: _controller.response,
      );
    }
  }

  void _goBack() {
    if (_stepIndex > 0) {
      setState(() => _stepIndex--);
      _pageController.animateToPage(
        _stepIndex,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeInOut,
      );
    } else {
      Navigator.pop(context);
    }
  }

  void _showWarning(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: 'Questionnaire (${_stepIndex + 1}/$_totalSteps)',
      body: Column(
        children: [
          LinearProgressIndicator(value: (_stepIndex + 1) / _totalSteps),
          Expanded(
            child: PageView(
              controller: _pageController,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                InterestsStep(controller: _controller),
                HobbiesStep(controller: _controller),
                StrengthsStep(controller: _controller),
                WorkStyleStep(controller: _controller),
                PriorityWeightsStep(controller: _controller),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _goBack,
                    child: const Text('Back'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _goNext,
                    child: Text(_stepIndex == _totalSteps - 1 ? 'Submit' : 'Next'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}