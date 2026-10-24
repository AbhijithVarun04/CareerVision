import 'package:flutter/material.dart';
import '../../config/constants.dart';
import '../../services/auth_service.dart';
import '../../widgets/app_scaffold.dart';

class ProfileScreen extends StatelessWidget {
  final bool embedded;
  const ProfileScreen({super.key, this.embedded = false});

  Future<void> _logOut(BuildContext context) async {
    await AuthService().logOut();
    if (!context.mounted) return;
    Navigator.pushNamedAndRemoveUntil(context, Routes.welcome, (r) => false);
  }

  @override
  Widget build(BuildContext context) {
    final user = AuthService().currentUser;
    final name = (user?.displayName ?? '').trim();

    final content = Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.account_circle, size: 72),
            const SizedBox(height: 12),
            if (name.isNotEmpty)
              Text(name, style: Theme.of(context).textTheme.titleLarge),
            if (user?.email != null) Text(user!.email!),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () =>
                  Navigator.pushNamed(context, Routes.attemptHistory),
              child: const Text('View Attempt History'),
            ),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: () =>
                  Navigator.pushNamed(context, Routes.questionnaire),
              child: const Text('Retake Assessment'),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: () => _logOut(context),
              child: const Text('Log out'),
            ),
          ],
        ),
      ),
    );

    if (embedded) {
      return SafeArea(child: content);
    }
    return AppScaffold(title: 'Profile', body: content);
  }
}