import 'package:flutter/material.dart';
import '../../config/constants.dart';

class HomeTab extends StatelessWidget {
  const HomeTab({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Welcome back!',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            const Text('Ready to explore your career journey?'),
            const SizedBox(height: 24),
            Card(
              child: ListTile(
                leading: const Icon(Icons.assignment_outlined, size: 32),
                title: const Text('Take Career Assessment'),
                subtitle: const Text('Answer a few questions to get personalized recommendations'),
                trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                onTap: () => Navigator.pushNamed(context, Routes.questionnaire),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: ListTile(
                leading: const Icon(Icons.history_outlined, size: 32),
                title: const Text('View Past Attempts'),
                subtitle: const Text('Review previous assessments and results'),
                trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                onTap: () => Navigator.pushNamed(context, Routes.attemptHistory),
              ),
            ),
          ],
        ),
      ),
    );
  }
}