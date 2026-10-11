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
  // Passing `settings` keeps the route name and arguments, so screens can
  // read them with ModalRoute.of(context)?.settings.arguments.
  static MaterialPageRoute<dynamic> _page(RouteSettings settings, Widget screen) {
    return MaterialPageRoute(settings: settings, builder: (_) => screen);
  }

  static Route<dynamic> generateRoute(RouteSettings settings) {
    switch (settings.name) {
      case Routes.splash:
        return _page(settings, const SplashScreen());
      case Routes.welcome:
        return _page(settings, const WelcomeScreen());
      case Routes.login:
        return _page(settings, const LoginScreen());
      case Routes.signup:
        return _page(settings, const SignupScreen());
      case Routes.home:
        return _page(settings, const HomeShell());
      case Routes.questionnaire:
        return _page(settings, const QuestionnaireScreen());
      case Routes.processing:
        return _page(settings, const ProcessingScreen());
      case Routes.recommendations:
        return _page(settings, const RecommendationListScreen());
      case Routes.careerDetail:
        return _page(settings, const CareerDetailScreen());
      case Routes.courseDetail:
        return _page(settings, const CourseDetailScreen());
      case Routes.collegeFinder:
        return _page(settings, const CollegeFinderScreen());
      case Routes.comparison:
        return _page(settings, const ComparisonScreen());
      case Routes.profile:
        return _page(settings, const ProfileScreen());
      case Routes.attemptHistory:
        return _page(settings, const AttemptHistoryScreen());
      default:
        return _page(
          settings,
          Scaffold(
            body: Center(child: Text('No route defined for ${settings.name}')),
          ),
        );
    }
  }
}