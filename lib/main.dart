import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

import 'app.dart';
import 'firebase_options.dart';

// Dev only. Set via --dart-define; both default to "off" so a normal or
// release build never points at the emulator.
const bool _useEmulator = bool.fromEnvironment('USE_EMULATOR');
const String _emulatorHost =
String.fromEnvironment('EMULATOR_HOST', defaultValue: '127.0.0.1');

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  if (_useEmulator) {
    // Same region as ProcessingScreen so both use the same instance.
    FirebaseFunctions.instanceFor(region: 'asia-south1')
        .useFunctionsEmulator(_emulatorHost, 5001);
  }

  runApp(const CareerVisionApp());
}