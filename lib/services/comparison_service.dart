import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

/// Carries a message that is safe to show a student.
class ComparisonSaveException implements Exception {
  ComparisonSaveException(this.message);
  final String message;

  @override
  String toString() => message;
}

class ComparisonService {
  /// Saves which careers were compared (REQ-7.3) under the attempt:
  /// students/{uid}/attempts/{attemptId}/comparisons/{key}
  /// The key is the sorted recommendation ids, so the same selection
  /// updates one document instead of creating duplicates.
  /// Throws [ComparisonSaveException] on any problem.
  Future<void> saveSelection({
    required String? attemptId,
    required List<String> recommendationIds,
  }) async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) {
      throw ComparisonSaveException(
          'You are signed out, so this comparison was not saved.');
    }
    if (attemptId == null || attemptId.isEmpty) {
      throw ComparisonSaveException(
          'This list is not linked to a saved attempt, so the comparison was not saved.');
    }
    if (recommendationIds.length < 2) {
      throw ComparisonSaveException('Choose at least two careers to compare.');
    }

    final ids = [...recommendationIds]..sort();
    try {
      await FirebaseFirestore.instance
          .collection('students')
          .doc(uid)
          .collection('attempts')
          .doc(attemptId)
          .collection('comparisons')
          .doc(ids.join('_'))
          .set({
        'comparison_date': FieldValue.serverTimestamp(),
        'recommendation_ids': ids,
      }).timeout(const Duration(seconds: 10));
    } on TimeoutException {
      throw ComparisonSaveException(
          'We could not confirm that this comparison was saved. Check your connection.');
    } on FirebaseException catch (e) {
      throw ComparisonSaveException(
          'Could not save this comparison (${e.code}).');
    } catch (_) {
      throw ComparisonSaveException('Could not save this comparison.');
    }
  }
}