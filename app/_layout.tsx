import { useEffect, useRef } from "react";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";

import "./global.css";
import { isStartupSettled } from "@/domain/auth";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { ProgressProvider } from "@/providers/ProgressProvider";
import { QuestionProvider } from "@/providers/QuestionProvider";

void SplashScreen.preventAutoHideAsync().catch(() => {
  // The native splash may already be hidden when this module reloads.
});

interface BootstrapProps {
  readonly fontsLoaded: boolean;
}

const Bootstrap = ({ fontsLoaded }: BootstrapProps) => {
  const authState = useAuth();
  const splashHiddenRef = useRef(false);
  const startupSettled = isStartupSettled(authState);
  const ready = fontsLoaded && startupSettled;

  useEffect(() => {
    if (!ready || splashHiddenRef.current) {
      return;
    }

    splashHiddenRef.current = true;
    void SplashScreen.hideAsync().catch(() => {
      // Ignore duplicate or platform-specific hide failures.
    });
  }, [ready]);

  if (!ready) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Rubik-Bold": require("../assets/fonts/Rubik-Bold.ttf"),
    "Rubik-ExtraBold": require("../assets/fonts/Rubik-ExtraBold.ttf"),
    "Rubik-Light": require("../assets/fonts/Rubik-Light.ttf"),
    "Rubik-Medium": require("../assets/fonts/Rubik-Medium.ttf"),
    "Rubik-Regular": require("../assets/fonts/Rubik-Regular.ttf"),
    "Rubik-SemiBold": require("../assets/fonts/Rubik-SemiBold.ttf"),
  });

  return (
    <AuthProvider>
      <QuestionProvider>
        <ProgressProvider>
          <Bootstrap fontsLoaded={fontsLoaded} />
        </ProgressProvider>
      </QuestionProvider>
    </AuthProvider>
  );
}
