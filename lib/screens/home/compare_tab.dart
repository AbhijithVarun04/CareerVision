import 'package:flutter/material.dart';
import '../comparison/comparison_screen.dart';

class CompareTab extends StatelessWidget {
  const CompareTab({super.key});

  @override
  Widget build(BuildContext context) {
    return const ComparisonScreen(embedded: true);
  }
}