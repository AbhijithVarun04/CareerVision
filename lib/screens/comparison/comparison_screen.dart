import 'package:flutter/material.dart';
import '../../widgets/app_scaffold.dart';

class ComparisonScreen extends StatelessWidget {
  final bool embedded;
  const ComparisonScreen({super.key, this.embedded = false});

  @override
  Widget build(BuildContext context) {
    const content = Center(child: Text('Comparison placeholder'));

    if (embedded) {
      return const SafeArea(child: content);
    }
    return const AppScaffold(title: 'Comparison', body: content);
  }
}