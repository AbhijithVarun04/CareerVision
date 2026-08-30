import 'package:flutter/material.dart';
import '../../state/questionnaire_controller.dart';

class PriorityWeightsStep extends StatelessWidget {
  final QuestionnaireController controller;
  const PriorityWeightsStep({super.key, required this.controller});

  @override
  Widget build(BuildContext context) {
    final r = controller.response;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('What matters most to you?',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          const Text('Adjust the sliders — they always add up to 100%.'),
          const SizedBox(height: 24),
          _weightSlider(
            label: 'Interest Fit',
            value: r.interestWeight,
            onChanged: (v) => controller.updateWeights(interest: v),
          ),
          _weightSlider(
            label: 'Salary',
            value: r.salaryWeight,
            onChanged: (v) => controller.updateWeights(salary: v),
          ),
          _weightSlider(
            label: 'Market Demand',
            value: r.demandWeight,
            onChanged: (v) => controller.updateWeights(demand: v),
          ),
        ],
      ),
    );
  }

  Widget _weightSlider({
    required String label,
    required double value,
    required ValueChanged<double> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('$label — ${(value * 100).round()}%'),
          Slider(
            value: value,
            min: 0,
            max: 1,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}