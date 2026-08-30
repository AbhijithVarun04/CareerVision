import 'package:flutter/material.dart';
import 'config/constants.dart';
import 'routes/app_router.dart';

class CareerVisionApp extends StatelessWidget {
  const CareerVisionApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CareerVision',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: Colors.indigo,
        useMaterial3: true,
      ),
      initialRoute: Routes.splash,
      onGenerateRoute: AppRouter.generateRoute,
    );
  }
}