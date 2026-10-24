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

## Running the Application Locally

## Prerequisites

Install Flutter, Git, Node.js, npm, and the Firebase CLI. Configure a Firebase project with Authentication enabled and ensure the required Firebase configuration files are available locally.

1. Clone the Repository

git clone https://github.com/AbhijithVarun04/CareerVision.git
cd CareerVision

2. Install Flutter Dependencies

flutter pub get

Generate the local Firebase configuration if it is not already available:

flutterfire configure

Download the appropriate google-services.json file into android/app/ for the Firebase project you configured.

3. Install Cloud Functions Dependencies

Open a terminal in the project root and run:

cd functions
npm install
cd ..

4. Configure API Secrets

Create functions/.secret.local locally and configure the required API keys:

GEMINI_API_KEY=your_gemini_api_key
TAVILY_API_KEY=your_tavily_api_key
EXA_API_KEY=your_exa_api_key

Replace the example values with your own keys. Never commit this file or expose API keys in the repository.

5. Start the Firebase Emulators

From the project root, run:

firebase emulators:start --only functions,firestore

Keep this terminal running while using the application.

6. Run the Flutter Application

Connect an Android device to the same local network as the computer running the emulators. Find the computer's current local IPv4 address and replace <PC_IPV4> below with that address.

flutter run --dart-define=USE_EMULATOR=true --dart-define=EMULATOR_HOST=<PC_IPV4>

The application connects to the local Firestore and Cloud Functions emulators. Firebase Authentication remains connected to the configured Firebase project. Features that use Gemini, Tavily, or Exa may make live external API requests and consume API quota.

Notes

Keep the emulator terminal open while running the app.

The computer's IPv4 address may change between networks.

Ensure your local Firebase configuration matches the project used for authentication.

The application has been tested locally and has not been deployed to production.

## Status
The application has been implemented and tested locally using the Firebase Emulator Suite. It has not been deployed to production. External services such as Gemini, Tavily, and Exa may require valid API keys for the relevant features to work.