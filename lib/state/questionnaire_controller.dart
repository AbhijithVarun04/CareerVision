import 'package:flutter/foundation.dart';
import '../models/questionnaire_response.dart';

class QuestionnaireController extends ChangeNotifier {
  final QuestionnaireResponse response = QuestionnaireResponse();

  void toggleInterest(String value) {
    _toggle(response.interests, value);
    notifyListeners();
  }

  void toggleStrength(String value) {
    _toggle(response.strengths, value);
    notifyListeners();
  }

  void toggleWorkStyle(String value) {
    _toggle(response.workStyles, value);
    notifyListeners();
  }

  void _toggle(List<String> list, String value) {
    if (list.contains(value)) {
      list.remove(value);
    } else {
      list.add(value);
    }
  }

  void setInterestsOther(String value) {
    response.interestsOther = value.trim().isEmpty ? null : value.trim();
  }

  void setStrengthsOther(String value) {
    response.strengthsOther = value.trim().isEmpty ? null : value.trim();
  }

  void setWorkStylesOther(String value) {
    response.workStylesOther = value.trim().isEmpty ? null : value.trim();
  }

  // Keeps all three weights summing to 1.0 whenever one slider moves.
  void updateWeights({double? interest, double? salary, double? demand}) {
    double i = interest ?? response.interestWeight;
    double s = salary ?? response.salaryWeight;
    double d = demand ?? response.demandWeight;

    final total = i + s + d;
    if (total > 0) {
      i /= total;
      s /= total;
      d /= total;
    }

    response.interestWeight = i;
    response.salaryWeight = s;
    response.demandWeight = d;
    notifyListeners();
  }

  void toggleHobby(String value) {
    _toggle(response.hobbies, value);
    notifyListeners();
  }

  void setHobbiesOther(String value) {
    response.hobbiesOther = value.trim().isEmpty ? null : value.trim();
  }
}