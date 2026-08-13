declare const process: {
  env: Record<string, string | undefined>;
};

type ExpoConfigContext = {
  config: Record<string, unknown>;
};

const configMode = process.env.EXPO_PUBLIC_RELATIVITYLAB_CONFIG_MODE;
const usesSafeConfig = configMode === "local" || configMode === "test";
const androidServiceFile = process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json";
const iosServiceFile = process.env.GOOGLE_SERVICE_INFO_PLIST ?? "./GoogleService-Info.plist";
const googleSignInPlugin = process.env.GOOGLE_SIGNIN_IOS_URL_SCHEME
  ? [
      "@react-native-google-signin/google-signin",
      {
        iosUrlScheme: process.env.GOOGLE_SIGNIN_IOS_URL_SCHEME,
      },
    ]
  : "@react-native-google-signin/google-signin";

const firebaseAppPlugin = [
  "@react-native-firebase/app",
  {
    androidGoogleServicesFile: androidServiceFile,
    iosGoogleServicesFile: iosServiceFile,
  },
];

export default ({ config }: ExpoConfigContext) => ({
  ...config,
  name: "relativitylab",
  slug: "relativitylab",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "relativitylab",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.relativitylab.app",
    usesAppleSignIn: true,
    ...(usesSafeConfig ? {} : { googleServicesFile: iosServiceFile }),
  },
  android: {
    package: "com.relativitylab.app",
    ...(usesSafeConfig ? {} : { googleServicesFile: androidServiceFile }),
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    ...(usesSafeConfig ? [] : [firebaseAppPlugin]),
    ...(usesSafeConfig ? [] : ["@react-native-firebase/auth"]),
    ...(usesSafeConfig ? [] : ["@react-native-firebase/firestore"]),
    ...(usesSafeConfig ? [] : [googleSignInPlugin]),
    "expo-apple-authentication",
    [
      "expo-build-properties",
      {
        ios: {
          useFrameworks: "dynamic",
        },
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        resizeMode: "cover",
        backgroundColor: "#ffffff",
        enableFullScreenImage_legacy: true,
      },
    ],
    [
      "expo-font",
      {
        fonts: [
          "./assets/fonts/Rubik-Bold.ttf",
          "./assets/fonts/Rubik-ExtraBold.ttf",
          "./assets/fonts/Rubik-Light.ttf",
          "./assets/fonts/Rubik-Medium.ttf",
          "./assets/fonts/Rubik-Regular.ttf",
          "./assets/fonts/Rubik-SemiBold.ttf",
        ],
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {
      origin: false,
    },
    eas: {
      projectId: "b9f184f7-77f8-42c7-9282-6e56d8644676",
    },
    nativeConfig: {
      mode: usesSafeConfig ? configMode : "native",
      androidServiceFile,
      iosServiceFile,
      serviceFilesRequired: !usesSafeConfig,
    },
  },
});
