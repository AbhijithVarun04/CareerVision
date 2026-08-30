import 'package:flutter/material.dart';
import '../../config/constants.dart';
import '../../widgets/app_scaffold.dart';

class RecommendationListScreen extends StatelessWidget {
  const RecommendationListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: 'Recommendations',
      body: Center(
        child: Wrap(
          spacing: 12,
          children: [
            ElevatedButton(
              onPressed: () => Navigator.pushNamed(context, Routes.careerDetail),
              child: const Text('Career Detail'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pushNamed(context, Routes.comparison),
              child: const Text('Comparison'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pushNamed(context, Routes.profile),
              child: const Text('Profile'),
            ),
          ],
        ),
      ),
    );
  }
}