import React, { useEffect, useState } from "react";
import * as AppleAuthentication from "expo-apple-authentication";
import { Redirect } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import icons from "@/constants/icons";
import { authStrings } from "@/constants/strings";
import { useAuth } from "@/providers/AuthProvider";

const Auth = () => {
  const {
    action,
    continueAsGuest,
    error,
    signInWithApple,
    signInWithGoogle,
    status,
  } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") {
      return;
    }

    let mounted = true;

    void AppleAuthentication.isAvailableAsync().then((available) => {
      if (mounted) {
        setAppleAvailable(available);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (status === "guest" || status === "authenticated") {
    return <Redirect href="/" />;
  }

  const active = action !== "none";
  const statusLabel =
    action === "none" ? null : authStrings.activeLabels[action];
  const errorMessage =
    error === null ? null : authStrings.messages[error.category];

  return (
    <SafeAreaView className="h-full bg-black">
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingVertical: 32,
        }}
      >
        <View className="items-center">
          <View className="mb-10 items-center">
            <Text className="text-center font-rubik-bold text-4xl text-white">
              {authStrings.appName}
            </Text>
            <Text className="mt-3 text-center font-rubik text-base text-zinc-300">
              {authStrings.tagline}
            </Text>
          </View>

          <View className="w-full gap-4">
            <Pressable
              accessibilityHint={authStrings.hints.google}
              accessibilityRole="button"
              accessibilityState={{ busy: action === "google", disabled: active }}
              className="h-14 w-full flex-row items-center justify-center rounded-lg bg-white px-5"
              disabled={active}
              onPress={signInWithGoogle}
            >
              {action === "google" ? (
                <ActivityIndicator color="#18181b" />
              ) : (
                <>
                  <Image
                    className="h-5 w-5"
                    resizeMode="contain"
                    source={icons.google}
                  />
                  <Text className="ml-3 font-rubik-medium text-base text-zinc-950">
                    {authStrings.actions.google}
                  </Text>
                </>
              )}
            </Pressable>

            {Platform.OS === "ios" && appleAvailable ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                cornerRadius={8}
                onPress={() => {
                  if (!active) {
                    void signInWithApple();
                  }
                }}
                style={{ height: 56, opacity: active ? 0.55 : 1, width: "100%" }}
              />
            ) : null}

            <Pressable
              accessibilityHint={authStrings.hints.guest}
              accessibilityRole="button"
              accessibilityState={{ busy: action === "guest", disabled: active }}
              className="h-14 w-full items-center justify-center rounded-lg border border-zinc-700 px-5"
              disabled={active}
              onPress={continueAsGuest}
            >
              {action === "guest" ? (
                <ActivityIndicator color="#fafafa" />
              ) : (
                <Text className="font-rubik-medium text-base text-white">
                  {authStrings.actions.guest}
                </Text>
              )}
            </Pressable>
          </View>

          <View className="mt-8 min-h-6 items-center">
            {statusLabel !== null ? (
              <Text
                accessibilityLiveRegion="polite"
                className="font-rubik text-sm text-zinc-300"
              >
                {statusLabel}
              </Text>
            ) : null}
            {errorMessage !== null ? (
              <Text
                accessibilityLiveRegion="polite"
                className="mt-2 text-center font-rubik text-sm text-red-300"
              >
                {errorMessage}
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Auth;
