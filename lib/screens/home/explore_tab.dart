import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../../config/constants.dart';

String _pct(dynamic v) =>
    '${((v is num ? v.toDouble() : 0.0) * 100).round()}%';

String _fmtDate(DateTime? d) {
  if (d == null) return 'date unavailable';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return '${d.day} ${months[d.month - 1]} ${d.year}';
}

class _LatestAttempt {
  _LatestAttempt({required this.date, required this.careers});
  final DateTime? date;
  final List<Map<String, dynamic>> careers;
}

class ExploreTab extends StatefulWidget {
  const ExploreTab({super.key});

  @override
  State<ExploreTab> createState() => _ExploreTabState();
}

class _ExploreTabState extends State<ExploreTab> {
  late Future<_LatestAttempt?> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_LatestAttempt?> _load() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) throw StateError('Not signed in');
    final attempts = FirebaseFirestore.instance
        .collection('students')
        .doc(uid)
        .collection('attempts');
    final latest = await attempts
        .orderBy('attempt_date', descending: true)
        .limit(1)
        .get();
    if (latest.docs.isEmpty) return null;

    final doc = latest.docs.first;
    final ts = doc.data()['attempt_date'];
    final recs = await attempts
        .doc(doc.id)
        .collection('recommendations')
        .orderBy('rank')
        .get();
    return _LatestAttempt(
      date: ts is Timestamp ? ts.toDate().toLocal() : null,
      // Same map shape the Recommendations screen passes to Career Detail.
      careers: recs.docs.map((d) => {'id': d.id, ...d.data()}).toList(),
    );
  }

  void _reload() {
    setState(() {
      _future = _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: FutureBuilder<_LatestAttempt?>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _Message(
              text: 'We could not load your careers.',
              actionLabel: 'Try again',
              onAction: _reload,
            );
          }
          final latest = snapshot.data;
          if (latest == null || latest.careers.isEmpty) {
            return _Message(
              text: 'Take an assessment to see your recommended careers here, '
                  'with their courses and Chennai colleges.',
              actionLabel: 'Take Career Assessment',
              onAction: () =>
                  Navigator.pushNamed(context, Routes.questionnaire),
            );
          }
          final theme = Theme.of(context);
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: latest.careers.length + 1,
            itemBuilder: (context, i) {
              if (i == 0) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Explore',
                          style: TextStyle(
                              fontSize: 24, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text(
                        'Careers from your latest assessment '
                            '(${_fmtDate(latest.date)}). Tap one to see its '
                            'details, then its courses and Chennai colleges.',
                        style: theme.textTheme.bodyMedium,
                      ),
                    ],
                  ),
                );
              }
              final career = latest.careers[i - 1];
              final rank = career['rank'];
              return Card(
                child: ListTile(
                  leading: CircleAvatar(
                    radius: 16,
                    child: Text(rank is num ? '${rank.round()}' : '-'),
                  ),
                  title: Text('${career['career_name'] ?? 'Career'}'),
                  subtitle:
                  Text('Overall match ${_pct(career['final_score'])}'),
                  trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                  onTap: () => Navigator.pushNamed(
                    context,
                    Routes.careerDetail,
                    arguments: career,
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({
    required this.text,
    required this.actionLabel,
    required this.onAction,
  });

  final String text;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(text, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            ElevatedButton(onPressed: onAction, child: Text(actionLabel)),
          ],
        ),
      ),
    );
  }
}