import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class AuthService {
  AuthService({FirebaseAuth? auth}) : _auth = auth ?? FirebaseAuth.instance;

  final FirebaseAuth _auth;

  User? get currentUser => _auth.currentUser;

  Future<void> signUp({
    required String name,
    required String email,
    required String password,
  }) async {
    final cred = await _auth.createUserWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
    final user = cred.user;
    if (user == null) return;

    try {
      await user.updateDisplayName(name.trim());
    } catch (_) {
      // The account already exists; a failed display name is not fatal.
    }

    try {
      await FirebaseFirestore.instance.collection('students').doc(user.uid).set({
        'name': name.trim(),
        'email': email.trim(),
        'created_at': FieldValue.serverTimestamp(),
      });
    } catch (_) {
      // The profile doc is a convenience record. A failed write must not
      // block a student who has just created an account.
    }
  }

  Future<void> logIn({
    required String email,
    required String password,
  }) async {
    await _auth.signInWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
  }

  Future<void> logOut() => _auth.signOut();

  /// Turns an error into a short message that is safe to show a student.
  static String messageFor(Object error) {
    if (error is FirebaseAuthException) {
      switch (error.code) {
        case 'invalid-email':
          return 'That email address does not look right.';
        case 'user-not-found':
        case 'wrong-password':
        case 'invalid-credential':
          return 'Incorrect email or password.';
        case 'email-already-in-use':
          return 'An account with this email already exists. Try logging in.';
        case 'weak-password':
          return 'Please choose a stronger password (at least 6 characters).';
        case 'user-disabled':
          return 'This account has been disabled.';
        case 'too-many-requests':
          return 'Too many attempts. Please wait a bit and try again.';
        case 'network-request-failed':
          return 'No connection. Check your internet and try again.';
        case 'operation-not-allowed':
          return 'Email sign-in is not enabled for this app yet.';
      }
    }
    return 'Something went wrong. Please try again.';
  }
}