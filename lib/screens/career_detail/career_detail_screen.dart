import 'package:flutter/material.dart';
import '../../config/constants.dart';
import '../../widgets/app_scaffold.dart';

class CareerDetailScreen extends StatelessWidget {
  const CareerDetailScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: 'Career Detail',
      body: Center(
        child: ElevatedButton(
          onPressed: () => Navigator.pushNamed(context, Routes.courseDetail),
          child: const Text('View Course Detail'),
        ),
      ),
    );
  }
}