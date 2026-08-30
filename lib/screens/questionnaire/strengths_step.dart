import 'package:flutter/material.dart';
import '../../config/questionnaire_options.dart';
import '../../state/questionnaire_controller.dart';

class StrengthsStep extends StatelessWidget {
  final QuestionnaireController controller;
  const StrengthsStep({super.key, required this.controller});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('What are your strengths?',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          const Text('Select all that apply.'),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: QuestionnaireOptions.strengths.map((option) {
              final selected = controller.response.strengths.contains(option);
              return FilterChip(
                label: Text(option),
                selected: selected,
                onSelected: (_) => controller.toggleStrength(option),
              );
            }).toList(),
          ),
          const SizedBox(height: 24),
          TextField(
            decoration: const InputDecoration(
              labelText: 'Anything else? (optional)',
              border: OutlineInputBorder(),
            ),
            maxLines: 2,
            onChanged: controller.setStrengthsOther,
          ),
        ],
      ),
    );
  }
}