export default {
    expo: {
      name: "RelativityLabMobileAndroid",
      slug: "RelativityLabMobileAndroid",
      version: "1.0.0",
      orientation: "portrait",
      icon: "./assets/icon.png",
      userInterfaceStyle: "light",
      splash: {
        image: "./assets/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#000000"
      },
      android: {
        package: "com.relativitylab.app",
        adaptiveIcon: {
          foregroundImage: "./assets/adaptive-icon.png",
          backgroundColor: "#000000"
        }
      },
      ios: {
        supportsTablet: true,
        bundleIdentifier: "com.relativitylab.app"
      },
      plugins: [
        "@react-native-firebase/app",
        "@react-native-firebase/auth"
      ],
      extra: {
        eas: {
          projectId: "56e1814d-5745-4cc9-b248-f8433ef286d7"
        }
      }
    }
  }