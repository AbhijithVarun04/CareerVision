import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../../config/constants.dart';
import '../../widgets/app_scaffold.dart';

class AttemptHistoryScreen extends StatefulWidget {
  const AttemptHistoryScreen({super.key});

  @override
  State<AttemptHistoryScreen> createState() => _AttemptHistoryScreenState();
}

class _AttemptItem {
  _AttemptItem({
    required this.id,
    required this.date,
    required this.summary,
    required this.weights,
  });

  final String id;
  final DateTime? date;
  final String summary;
  final Map<String, double> weights;

  factory _AttemptItem.fromDoc(QueryDocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data();
    final ts = data['attempt_date'];
    final signal = data['signal_profile'];
    final summary = (signal is Map && signal['summary'] is String)
        ? signal['summary'] as String
        : '';
    return _AttemptItem(
      id: doc.id,
      date: ts is Timestamp ? ts.toDate().toLocal() : null,
      summary: summary,
      weights: _normalisedWeights(data['priority_weights']),
    );
  }

  // Same normalisation the callable applies: divide by the sum.
  static Map<String, double> _normalisedWeights(dynamic raw) {
    double read(String key) {
      if (raw is Map && raw[key] is num) {
        final v = (raw[key] as num).toDouble();
        return v.isFinite && v > 0 ? v : 0;
      }
      return 0;
    }

    final i = read('interest');
    final s = read('salary');
    final d = read('demand');
    final total = i + s + d;
    if (total <= 0) {
      return {'interest': 1 / 3, 'salary': 1 / 3, 'demand': 1 / 3};
    }
    return {'interest': i / total, 'salary': s / total, 'demand': d / total};
  }
}

class _AttemptHistoryScreenState extends State<AttemptHistoryScreen> {
  late Future<List<_AttemptItem>> _future;
  bool _opening = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  String? get _uid => FirebaseAuth.instance.currentUser?.uid;

  Future<List<_AttemptItem>> _load() async {
    final uid = _uid;
    if (uid == null) throw StateError('Not signed in');
    final snap = await FirebaseFirestore.instance
        .collection('students')
        .doc(uid)
        .collection('attempts')
        .orderBy('attempt_date', descending: true)
        .limit(50)
        .get();
    return snap.docs.map(_AttemptItem.fromDoc).toList();
  }

  void _reload() {
    setState(() {
      _future = _load();
    });
  }

  Future<void> _open(_AttemptItem item) async {
    final uid = _uid;
    if (uid == null || _opening) return;
    setState(() => _opening = true);
    try {
      final recSnap = await FirebaseFirestore.instance
          .collection('students')
          .doc(uid)
          .collection('attempts')
          .doc(item.id)
          .collection('recommendations')
          .orderBy('rank')
          .get();
      final recs = recSnap.docs.map((d) => {'id': d.id, ...d.data()}).toList();
      if (!mounted) return;
      // Same shape as the submitAssessment response, so the
      // Recommendations screen can show it unchanged.
      Navigator.pushNamed(context, Routes.recommendations, arguments: {
        'attemptId': item.id,
        'summary': item.summary,
        'weights': item.weights,
        'recommendations': recs,
      });
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open this attempt. Try again.')),
      );
    } finally {
      if (mounted) setState(() => _opening = false);
    }
  }

  static String _formatDate(DateTime? d) {
    if (d == null) return 'Date unavailable';
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    final hour = d.hour % 12 == 0 ? 12 : d.hour % 12;
    final minute = d.minute.toString().padLeft(2, '0');
    final suffix = d.hour >= 12 ? 'PM' : 'AM';
    return '${d.day} ${months[d.month - 1]} ${d.year}, $hour:$minute $suffix';
  }

  static String _weightsLine(Map<String, double> w) {
    String pct(String k) => '${((w[k] ?? 0) * 100).round()}%';
    return 'Interest ${pct('interest')} · Salary ${pct('salary')} · Demand ${pct('demand')}';
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: 'Attempt History',
      body: FutureBuilder<List<_AttemptItem>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('We could not load your attempts.'),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: _reload,
                      child: const Text('Try again'),
                    ),
                  ],
                ),
              ),
            );
          }
          final items = snapshot.data ?? const <_AttemptItem>[];
          if (items.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'No attempts yet. Take the assessment to see your first recommendations.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: () =>
                          Navigator.pushNamed(context, Routes.questionnaire),
                      child: const Text('Take Career Assessment'),
                    ),
                  ],
                ),
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (context, i) {
              final item = items[i];
              return Card(
                child: ListTile(
                  title: Text(_formatDate(item.date)),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 4),
                      Text(_weightsLine(item.weights)),
                      if (item.summary.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          item.summary,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ],
                  ),
                  trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                  onTap: _opening ? null : () => _open(item),
                ),
              );
            },
          );
        },
      ),
    );
  }
}