class QuestionnaireResponse {
  List<String> interests;
  String? interestsOther;

  List<String> hobbies;
  String? hobbiesOther;

  List<String> strengths;
  String? strengthsOther;

  List<String> workStyles;
  String? workStylesOther;

  double interestWeight;
  double salaryWeight;
  double demandWeight;

  QuestionnaireResponse({
    List<String>? interests,
    this.interestsOther,
    List<String>? hobbies,
    this.hobbiesOther,
    List<String>? strengths,
    this.strengthsOther,
    List<String>? workStyles,
    this.workStylesOther,
    this.interestWeight = 0.34,
    this.salaryWeight = 0.33,
    this.demandWeight = 0.33,
  })  : interests = interests ?? [],
        hobbies = hobbies ?? [],
        strengths = strengths ?? [],
        workStyles = workStyles ?? [];

  bool get isBasicsComplete =>
      interests.isNotEmpty && strengths.isNotEmpty && workStyles.isNotEmpty;
  // Note: hobbies is intentionally optional — not required in isBasicsComplete.

  Map<String, dynamic> toJson() => {
    'interests': interests,
    'interestsOther': interestsOther,
    'hobbies': hobbies,
    'hobbiesOther': hobbiesOther,
    'strengths': strengths,
    'strengthsOther': strengthsOther,
    'workStyles': workStyles,
    'workStylesOther': workStylesOther,
    'priorityWeights': {
      'interestWeight': interestWeight,
      'salaryWeight': salaryWeight,
      'demandWeight': demandWeight,
    },
  };
}