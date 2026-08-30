import 'package:flutter/material.dart';
import '../../config/constants.dart';
import '../../widgets/app_scaffold.dart';

class ProfileScreen extends StatelessWidget {
  final bool embedded;
  const ProfileScreen({super.key, this.embedded = false});

  @override
  Widget build(BuildContext context) {
    final content = Center(
      child: ElevatedButton(
        onPressed: () => Navigator.pushNamed(context, Routes.attemptHistory),
        child: const Text('View Attempt History'),
      ),
    );

    if (embedded) {
      return SafeArea(child: content);
    }
    return AppScaffold(title: 'Profile', body: content);
  }
}