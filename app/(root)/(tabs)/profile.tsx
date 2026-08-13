import { useEffect, useState } from "react";
import * as AppleAuthentication from "expo-apple-authentication";
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Link } from "expo-router";
import { CheckCircle2, RefreshCw } from "lucide-react-native";

import icons from "@/constants/icons";
import { authStrings, profileStrings } from "@/constants/strings";
import { Question } from "@/domain/questions";
import { useAuth } from "@/providers/AuthProvider";
import { useProgress } from "@/providers/ProgressProvider";
import { useQuestions } from "@/providers/QuestionProvider";

interface SettingsItemProp {
  icon: ImageSourcePropType;
  title: string;
  onPress: () => void;
  textStyle?: string;
  disabled?: boolean;
}

const SettingsItem = ({
  icon,
  title,
  onPress,
  textStyle,
  disabled = false,
}: SettingsItemProp) => (
  <TouchableOpacity
    accessibilityRole="button"
    disabled={disabled}
    onPress={onPress}
    className={`flex flex-row items-center justify-between py-3 ${
      disabled ? "opacity-50" : ""
    }`}
  >
    <View className="flex flex-row items-center gap-3">
      <Image source={icon} className="size-6" />
      <Text className={`text-lg font-rubik-medium text-black-300 ${textStyle}`}>
        {title}
      </Text>
    </View>

    {disabled && <ActivityIndicator size="small" color="#dc2626" />}
  </TouchableOpacity>
);

const GuestProfile = ({
  action,
  appleAvailable,
  children,
  onSignInWithApple,
  onSignInWithGoogle,
}: {
  readonly action: "none" | "google" | "apple" | "guest" | "signOut";
  readonly appleAvailable: boolean;
  readonly children: React.ReactNode;
  readonly onSignInWithApple: () => void;
  readonly onSignInWithGoogle: () => void;
}) => (
  <ScrollView
    showsVerticalScrollIndicator={false}
    contentContainerClassName="px-7 pb-32 pt-10"
  >
    <View className="items-center">
      <View className="size-28 items-center justify-center rounded-full bg-primary-100">
        <Image source={icons.person} className="size-14" resizeMode="contain" />
      </View>

      <Text className="mt-6 text-center text-2xl font-rubik-bold text-black-300">
        Guest profile
      </Text>
      <Text className="mt-3 text-center font-rubik text-base leading-6 text-black-200">
        {profileStrings.guestDescription}
      </Text>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={authStrings.actions.google}
        disabled={action !== "none"}
        onPress={onSignInWithGoogle}
        className={`mt-8 min-h-14 w-full flex-row items-center justify-center rounded-2xl bg-primary-300 px-6 ${
          action !== "none" ? "opacity-60" : ""
        }`}
      >
        {action === "google" ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <>
            <Image source={icons.google} className="size-5" resizeMode="contain" />
            <Text className="ml-3 font-rubik-semibold text-base text-white">
              {authStrings.actions.google}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {Platform.OS === "ios" && appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          accessibilityLabel={authStrings.actions.apple}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          cornerRadius={8}
          onPress={onSignInWithApple}
          style={{
            height: 56,
            marginTop: 12,
            opacity: action === "none" ? 1 : 0.6,
            width: "100%",
          }}
        />
      ) : null}
    </View>

    {children}
  </ScrollView>
);

const syncText = {
  failed: profileStrings.syncFailed,
  pending: profileStrings.syncPending,
  synced: profileStrings.syncSynced,
} as const;

const orderSolvedQuestions = (
  solvedQuestionIds: ReadonlySet<string>,
  questions: readonly Question[],
): { readonly id: string; readonly label: string; readonly known: boolean }[] => {
  const knownQuestions = questions
    .filter((question) => solvedQuestionIds.has(question.id))
    .map((question) => ({
      id: question.id,
      label: `Question ${question.number}`,
      known: true,
    }));
  const knownIds = new Set(knownQuestions.map((question) => question.id));
  const unknownQuestions = Array.from(solvedQuestionIds)
    .filter((id) => !knownIds.has(id))
    .sort((left, right) => left.localeCompare(right))
    .map((id) => ({
      id,
      label: profileStrings.unknownQuestion,
      known: false,
    }));

  return [...knownQuestions, ...unknownQuestions];
};

const ProgressSummary = () => {
  const { retry, state } = useQuestions();
  const {
    isLoading,
    retrySync,
    solvedQuestionIds,
    syncStatus,
  } = useProgress();
  const solvedQuestions = orderSolvedQuestions(
    solvedQuestionIds,
    state.kind === "ready" ? state.questions : [],
  );
  const visibleSolvedCount = solvedQuestions.filter(
    (question) => question.known,
  ).length;

  return (
    <View className="mt-8 border-t border-primary-200 pt-5">
      <View className="flex-row items-center justify-between gap-4">
        <View>
          <Text className="font-rubik-bold text-xl text-black-300">
            {profileStrings.solvedHeading}
          </Text>
          <Text className="mt-1 font-rubik text-sm text-black-200">
            {profileStrings.solvedCount}: {visibleSolvedCount}
          </Text>
        </View>
        {isLoading && <ActivityIndicator color="#0061ff" />}
      </View>

      <View className="mt-4 flex-row items-center gap-2 rounded-lg bg-primary-100 px-4 py-3">
        <Text
          accessibilityLiveRegion="polite"
          className="min-w-0 flex-1 font-rubik text-sm text-black-300"
        >
          {syncText[syncStatus]}
        </Text>
        {syncStatus === "failed" && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={profileStrings.retrySync}
            onPress={() => void retrySync()}
            className="min-h-11 min-w-11 items-center justify-center rounded-lg bg-white"
          >
            <RefreshCw size={18} color="#0061ff" />
          </TouchableOpacity>
        )}
      </View>

      {state.kind === "error" && state.retryable && (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => void retry()}
          className="mt-3 min-h-12 items-center justify-center rounded-lg border border-primary-300 px-4"
        >
          <Text className="font-rubik-medium text-base text-primary-300">
            Retry question load
          </Text>
        </TouchableOpacity>
      )}

      <View className="mt-4 gap-3">
        {solvedQuestions.length === 0 ? (
          <Text className="font-rubik text-base text-black-200">
            {profileStrings.solvedEmpty}
          </Text>
        ) : (
          solvedQuestions.map((question, index) => (
            question.known ? (
              <Link
                key={question.id}
                href={{ pathname: "/quiz", params: { id: question.id } }}
                asChild
              >
                <TouchableOpacity
                  accessibilityRole="link"
                  accessibilityLabel={question.label}
                  className="min-h-12 flex-row items-center gap-3 rounded-lg border border-primary-200 px-4"
                >
                  <Text className="font-rubik-medium text-sm text-black-200">
                    {index + 1}.
                  </Text>
                  <CheckCircle2 size={18} color="#16a34a" />
                  <Text className="min-w-0 flex-1 font-rubik-medium text-base text-black-300">
                    {question.label}
                  </Text>
                </TouchableOpacity>
              </Link>
            ) : (
              <View
                key={question.id}
                accessibilityRole="text"
                accessibilityLabel={profileStrings.unknownQuestion}
                className="min-h-12 flex-row items-center gap-3 rounded-lg border border-primary-200 px-4 opacity-70"
              >
                <Text className="font-rubik-medium text-sm text-black-200">
                  {index + 1}.
                </Text>
                <CheckCircle2 size={18} color="#16a34a" />
                <Text className="min-w-0 flex-1 font-rubik-medium text-base text-black-300">
                  {question.label}
                </Text>
              </View>
            )
          ))
        )}
      </View>
    </View>
  );
};

const Profile = () => {
  const {
    action,
    signInWithApple,
    signInWithGoogle,
    signOut,
    status,
    user,
  } = useAuth();
  const [failedPhotoURL, setFailedPhotoURL] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") {
      return;
    }

    let active = true;
    void AppleAuthentication.isAvailableAsync().then((available) => {
      if (active) {
        setAppleAvailable(available);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  if (status === "guest") {
    return (
      <SafeAreaView className="h-full bg-white">
        <GuestProfile
          action={action}
          appleAvailable={appleAvailable}
          onSignInWithApple={() => {
            if (action === "none") {
              void signInWithApple();
            }
          }}
          onSignInWithGoogle={() => void signInWithGoogle()}
        >
          <ProgressSummary />
        </GuestProfile>
      </SafeAreaView>
    );
  }

  if (status !== "authenticated" || user === null) {
    return null;
  }

  const displayName = user.displayName ?? "Relativity Explorer";
  const email = user.email ?? "No email address available";
  const showPhotoFallback =
    user.photoURL === null || failedPhotoURL === user.photoURL;

  return (
    <SafeAreaView className="h-full bg-white">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-7 pb-32"
      >
        <View className="mt-5 flex flex-row items-center justify-between">
          <Text className="text-xl font-rubik-bold">Profile</Text>
        </View>

        <View className="mt-10 flex flex-col items-center">
          {showPhotoFallback ? (
            <View
              accessibilityLabel={`${displayName} profile placeholder`}
              className="size-44 items-center justify-center rounded-full bg-primary-100"
            >
              <Text className="font-rubik-bold text-5xl text-primary-300">
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          ) : (
            <Image
              accessibilityLabel={`${displayName} profile photo`}
              onError={() => setFailedPhotoURL(user.photoURL)}
              source={{ uri: user.photoURL }}
              className="size-44 rounded-full"
            />
          )}

          <Text className="mt-4 text-center text-2xl font-rubik-bold text-black-300">
            {displayName}
          </Text>
          <Text className="mt-1 text-center font-rubik text-base text-black-200">
            {email}
          </Text>
        </View>

        <View className="mt-8 flex flex-col border-t border-primary-200 pt-5">
          <SettingsItem
            icon={icons.logout}
            title="Sign out"
            textStyle="text-danger"
            disabled={action === "signOut"}
            onPress={() => void signOut()}
          />
        </View>

        <ProgressSummary />
      </ScrollView>
    </SafeAreaView>
  );
};

export default Profile;
