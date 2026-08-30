import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:careervision/app.dart';

void main() {
  testWidgets('App boots into splash screen', (WidgetTester tester) async {
    await tester.pumpWidget(const CareerVisionApp());
    await tester.pump(); // let the first frame settle without waiting for animation to finish

    expect(find.text('CareerVision'), findsOneWidget);
    expect(find.text('AI-Powered Career Guidance'), findsOneWidget);
  });
}