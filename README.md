# Relativity Lab Mobile

Native Android and iOS learning application built with Expo Router, Firebase,
and React Three Fiber. The app supports provider sign-in or guest use, cached
questions and progress, and fully bundled three-dimensional learning scenes.

## Local development

```bash
npm ci
npm start
```

Native Firebase and provider sign-in require a development build; Expo Go is
not a valid runtime for those features.

## Native configuration

Provide platform service files outside version control:

- Android: `google-services.json`, or set `GOOGLE_SERVICES_JSON` to its path.
- iOS: `GoogleService-Info.plist`, or set `GOOGLE_SERVICE_INFO_PLIST` to its
  path.
- Google sign-in: set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` to the Firebase web
  client ID. Set `GOOGLE_SIGNIN_IOS_URL_SCHEME` when the iOS scheme cannot be
  derived by the config plugin.

Use `EXPO_PUBLIC_RELATIVITYLAB_CONFIG_MODE=test` for credential-free lint,
tests, and configuration inspection. Never place private keys, provider tokens,
or native service files in source control.

## Verification

```bash
npm run lint
npx tsc --noEmit
npm run test:ci
npm run test:rules
EXPO_PUBLIC_RELATIVITYLAB_CONFIG_MODE=test npx expo config --type public
```

The Firestore emulator suite verifies public question reads, denied client
question writes, and owner-only append-style progress updates.
