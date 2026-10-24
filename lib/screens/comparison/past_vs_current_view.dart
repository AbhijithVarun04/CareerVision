import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../../config/constants.dart';

String _pct(double v) => '${(v * 100).round()}%';

String _fmtDate(DateTime? d) {
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

// Same normalisation the scoring engine applies: divide by the sum.
Map<String, double> _weightsFrom(dynamic raw) {
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
  if (total <= 0) return {'interest': 1 / 3, 'salary': 1 / 3, 'demand': 1 / 3};
  return {'interest': i / total, 'salary': s / total, 'demand': d / total};
}

String _weightsLine(Map<String, double> w) {
  String pct(String k) => '${((w[k] ?? 0) * 100).round()}%';
  return 'Interest ${pct('interest')} · Salary ${pct('salary')} · Demand ${pct('demand')}';
}

class _Attempt {
  _Attempt({required this.id, required this.date, required this.weights});
  final String id;
  final DateTime? date;
  final Map<String, double> weights;
}

_Attempt _attemptFrom(QueryDocumentSnapshot<Map<String, dynamic>> d) {
  final data = d.data();
  final ts = data['attempt_date'];
  return _Attempt(
    id: d.id,
    date: ts is Timestamp ? ts.toDate().toLocal() : null,
    weights: _weightsFrom(data['priority_weights']),
  );
}

class _Rec {
  _Rec({required this.name, required this.rank, required this.score});
  final String name;
  final int rank;
  final double score;

  // Recommendation ids differ for every attempt, so careers are matched
  // across attempts by name (trimmed, lower-case, single spaces).
  String get key => name.trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');
}

class PastVsCurrentView extends StatefulWidget {
  const PastVsCurrentView({super.key});

  @override
  State<PastVsCurrentView> createState() => _PastVsCurrentViewState();
}

class _PastVsCurrentViewState extends State<PastVsCurrentView> {
  bool _loading = true;
  bool _switching = false;
  String? _error;
  List<_Attempt> _attempts = [];
  _Attempt? _previous;
  List<_Rec> _latestRecs = [];
  List<_Rec> _previousRecs = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  CollectionReference<Map<String, dynamic>> _attemptsRef() {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) throw StateError('Not signed in');
    return FirebaseFirestore.instance
        .collection('students')
        .doc(uid)
        .collection('attempts');
  }

  Future<List<_Rec>> _recsFor(String attemptId) async {
    final snap = await _attemptsRef()
        .doc(attemptId)
        .collection('recommendations')
        .orderBy('rank')
        .get();
    final out = <_Rec>[];
    for (final d in snap.docs) {
      final m = d.data();
      final name = (m['career_name'] ?? '').toString().trim();
      if (name.isEmpty) continue;
      out.add(_Rec(
        name: name,
        rank: (m['rank'] as num?)?.toInt() ?? 0,
        score: (m['final_score'] as num?)?.toDouble() ?? 0,
      ));
    }
    return out;
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final snap = await _attemptsRef()
          .orderBy('attempt_date', descending: true)
          .limit(20)
          .get();
      final attempts = snap.docs.map(_attemptFrom).toList();
      var latest = <_Rec>[];
      var previous = <_Rec>[];
      if (attempts.length >= 2) {
        latest = await _recsFor(attempts[0].id);
        previous = await _recsFor(attempts[1].id);
      }
      if (!mounted) return;
      setState(() {
        _attempts = attempts;
        _previous = attempts.length >= 2 ? attempts[1] : null;
        _latestRecs = latest;
        _previousRecs = previous;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'We could not load your attempts.';
      });
    }
  }

  Future<void> _pickPrevious(_Attempt a) async {
    setState(() => _switching = true);
    try {
      final recs = await _recsFor(a.id);
      if (!mounted) return;
      setState(() {
        _previous = a;
        _previousRecs = recs;
      });
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not load that attempt. Try again.')),
      );
    } finally {
      if (mounted) setState(() => _switching = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return _Message(
        text: _error!,
        actionLabel: 'Try again',
        onAction: _load,
      );
    }
    final previous = _previous;
    if (_attempts.length < 2 || previous == null) {
      return _Message(
        text: 'Past vs Current needs at least two saved assessments, and you '
            'have ${_attempts.length}. Take another assessment, then come back here.',
        actionLabel: 'Take Career Assessment',
        onAction: () => Navigator.pushNamed(context, Routes.questionnaire),
      );
    }

    final theme = Theme.of(context);
    final latest = _attempts.first;

    final prevByKey = {for (final r in _previousRecs) r.key: r};
    final latestKeys = {for (final r in _latestRecs) r.key};
    final both =
    _latestRecs.where((r) => prevByKey.containsKey(r.key)).toList();
    final added =
    _latestRecs.where((r) => !prevByKey.containsKey(r.key)).toList();
    final dropped =
    _previousRecs.where((r) => !latestKeys.contains(r.key)).toList();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Past vs Current', style: theme.textTheme.titleLarge),
        const SizedBox(height: 8),
        Text('Latest: ${_fmtDate(latest.date)}',
            style: theme.textTheme.bodyMedium),
        const SizedBox(height: 8),
        Text('Compare with', style: theme.textTheme.bodySmall),
        DropdownButton<String>(
          isExpanded: true,
          value: previous.id,
          items: [
            for (final a in _attempts.skip(1))
              DropdownMenuItem(value: a.id, child: Text(_fmtDate(a.date))),
          ],
          onChanged: _switching
              ? null
              : (id) {
            if (id == null || id == previous.id) return;
            _pickPrevious(_attempts.firstWhere((a) => a.id == id));
          },
        ),
        if (_switching) const LinearProgressIndicator(),
        const SizedBox(height: 8),
        Text('Priorities then: ${_weightsLine(previous.weights)}',
            style: theme.textTheme.bodySmall),
        Text('Priorities now: ${_weightsLine(latest.weights)}',
            style: theme.textTheme.bodySmall),
        const SizedBox(height: 16),
        if (both.isNotEmpty) ...[
          _SectionTitle('In both attempts'),
          for (final r in both)
            _ChangeTile(before: prevByKey[r.key]!, after: r),
        ],
        if (added.isNotEmpty) ...[
          _SectionTitle('Only in your latest attempt'),
          for (final r in added) _OnlyTile(rec: r),
        ],
        if (dropped.isNotEmpty) ...[
          _SectionTitle('Only in the earlier attempt'),
          for (final r in dropped) _OnlyTile(rec: r),
        ],
        const SizedBox(height: 16),
        Text(
          'Overall scores are relative to each attempt\'s own shortlist and '
              'priorities, so look at rank and direction rather than exact points. '
              'Careers are matched across attempts by name.',
          style: theme.textTheme.bodySmall,
        ),
      ],
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 4),
      child: Text(text, style: Theme.of(context).textTheme.titleMedium),
    );
  }
}

class _ChangeTile extends StatelessWidget {
  const _ChangeTile({required this.before, required this.after});
  final _Rec before;
  final _Rec after;

  @override
  Widget build(BuildContext context) {
    final rankDiff = before.rank - after.rank;
    final rankText = rankDiff > 0
        ? 'up $rankDiff'
        : rankDiff < 0
        ? 'down ${-rankDiff}'
        : 'no change';
    final pts = (_pct(after.score) == _pct(before.score))
        ? 0
        : (int.parse(_pct(after.score).replaceAll('%', '')) -
        int.parse(_pct(before.score).replaceAll('%', '')));
    final ptsText = pts > 0
        ? '+$pts pts'
        : pts < 0
        ? '$pts pts'
        : 'no change';
    return Card(
      child: ListTile(
        isThreeLine: true,
        title: Text(after.name),
        subtitle: Text(
          'Rank #${before.rank} → #${after.rank} ($rankText)\n'
              'Overall ${_pct(before.score)} → ${_pct(after.score)} ($ptsText)',
        ),
      ),
    );
  }
}

class _OnlyTile extends StatelessWidget {
  const _OnlyTile({required this.rec});
  final _Rec rec;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(rec.name),
        subtitle: Text('Rank #${rec.rank} · overall ${_pct(rec.score)}'),
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