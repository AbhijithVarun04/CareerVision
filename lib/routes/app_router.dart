import 'package:flutter/material.dart';
import '../config/constants.dart';
import '../screens/splash/splash_screen.dart';
import '../screens/onboarding/welcome_screen.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/signup_screen.dart';
import '../screens/home/home_shell.dart';
import '../screens/questionnaire/questionnaire_screen.dart';
import '../screens/pipeline/processing_screen.dart';
import '../screens/recommendations/recommendation_list_screen.dart';
import '../screens/career_detail/career_detail_screen.dart';
import '../screens/career_detail/course_detail_screen.dart';
import '../screens/colleges/college_finder_screen.dart';
import '../screens/comparison/comparison_screen.dart';
import '../screens/profile/profile_screen.dart';
import '../screens/profile/attempt_history_screen.dart';

class AppRouter {
  static Route<dynamic> generateRoute(RouteSettings settings) {
    switch (settings.name) {
      case Routes.splash:
        return MaterialPageRoute(builder: (_) => const SplashScreen());
      case Routes.welcome:
        return MaterialPageRoute(builder: (_) => const WelcomeScreen());
      case Routes.login:
        return MaterialPageRoute(builder: (_) => const LoginScreen());
      case Routes.signup:
        return MaterialPageRoute(builder: (_) => const SignupScreen());
      case Routes.home:
        return MaterialPageRoute(builder: (_) => const HomeShell());
      case Routes.questionnaire:
        return MaterialPageRoute(builder: (_) => const QuestionnaireScreen());
      case Routes.processing:
        return MaterialPageRoute(builder: (_) => const ProcessingScreen());
      case Routes.recommendations:
        return MaterialPageRoute(builder: (_) => const RecommendationListScreen());
      case Routes.careerDetail:
        return MaterialPageRoute(builder: (_) => const CareerDetailScreen());
      case Routes.courseDetail:
        return MaterialPageRoute(builder: (_) => const CourseDetailScreen());
      case Routes.collegeFinder:
        return MaterialPageRoute(builder: (_) => const CollegeFinderScreen());
      case Routes.comparison:
        return MaterialPageRoute(builder: (_) => const ComparisonScreen());
      case Routes.profile:
        return MaterialPageRoute(builder: (_) => const ProfileScreen());
      case Routes.attemptHistory:
        return MaterialPageRoute(builder: (_) => const AttemptHistoryScreen());
      default:
        return MaterialPageRoute(
          builder: (_) => Scaffold(
            body: Center(child: Text('No route defined for ${settings.name}')),
          ),
        );
    }
  }
}