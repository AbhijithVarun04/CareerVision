# CareerVision

A mobile app that helps students who just finished 12th grade in Chennai, India
figure out a career path using live market data and a deterministic scoring engine,
instead of defaulting to whatever course their parents or peers pick.

## Tech Stack
- **Client:** Flutter (Android)
- **Backend:** Firebase Cloud Functions (Node.js)
- **Database:** Cloud Firestore
- **Auth:** Firebase Authentication
- **External APIs:** Google Gemini, Tavily, Exa

## Setup

This project connects to a private Firebase backend. Two config files are
intentionally excluded from version control for security:
- `lib/firebase_options.dart`
- `android/app/google-services.json`

See `lib/firebase_options.example.dart` for the expected structure.
To run this project with your own Firebase backend:
1. Create a Firebase project (Auth, Firestore, Cloud Functions on Blaze plan)
2. Run `flutterfire configure` to generate `firebase_options.dart`
3. Download `google-services.json` into `android/app/`
4. Set Cloud Functions secrets: `GEMINI_API_KEY`, `TAVILY_API_KEY`, `EXA_API_KEY`

## Status
Actively in development. See project documentation for current progress.