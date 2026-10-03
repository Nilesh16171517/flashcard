# RecallForge authentication and Google Drive setup

The application now uses Firebase Authentication and Google Drive's `drive.file` OAuth scope.

## 1. Create/configure Firebase

In Firebase Console:

1. Create or select the RecallForge Firebase project.
2. Add a Web app and copy its configuration values.
3. Enable **Authentication → Sign-in method → Email/Password**.
4. Enable **Google** as a sign-in provider.
5. Add the deployed RecallForge GitHub Pages domain to **Authentication → Settings → Authorized domains**.

## 2. Enable Google Drive API

In the Google Cloud project associated with Firebase:

1. Enable **Google Drive API**.
2. Use the Google OAuth client created/managed for the Firebase Google sign-in provider.
3. Keep the RecallForge Drive permission limited to:
   `https://www.googleapis.com/auth/drive.file`

RecallForge does not request the unrestricted `drive` scope.

## 3. GitHub Pages secrets

In GitHub repository **Settings → Secrets and variables → Actions**, add:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

The deployment workflow injects these into the production build. No Firebase secrets are committed to the repository.

## 4. What Drive access means

RecallForge asks Google for the `drive.file` permission.

The app creates a dedicated **RecallForge** folder and stores its own backup file there. It does not scan the user's unrelated Drive documents.

The application UI explicitly explains this before Drive authorization.

## 5. Data model

Each Firebase user gets a separate local IndexedDB namespace:

`recallforge-v1-<firebase-user-id>`

and a separate Google Drive connection/folder.

A new device first restores the user's existing RecallForge backup from Drive when its local workspace is empty, then future changes are synchronized back to Drive.

## 6. Password reset

Firebase handles password reset emails. RecallForge never stores or exposes plaintext passwords.

## 7. Important deployment note

The repository contains the implementation, but Firebase/Google Cloud credentials and OAuth configuration belong to the project owner and cannot be safely created or committed from source control. Until the six GitHub Actions secrets above are configured, the deployed site will show an authentication setup message rather than exposing a broken or insecure login flow.
