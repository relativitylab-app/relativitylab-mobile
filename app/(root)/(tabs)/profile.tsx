import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import icons from "@/constants/icons";
import { useAuth } from "@/providers/AuthProvider";

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
  isReturning,
  onReturnToSignIn,
}: {
  isReturning: boolean;
  onReturnToSignIn: () => void;
}) => (
  <View className="flex-1 items-center justify-center px-7">
    <View className="size-28 items-center justify-center rounded-full bg-primary-100">
      <Image source={icons.person} className="size-14" resizeMode="contain" />
    </View>

    <Text className="mt-6 text-center text-2xl font-rubik-bold text-black-300">
      Guest profile
    </Text>
    <Text className="mt-3 text-center font-rubik text-base leading-6 text-black-200">
      Sign in to keep your learning progress available across devices.
    </Text>

    <TouchableOpacity
      accessibilityRole="button"
      disabled={isReturning}
      onPress={onReturnToSignIn}
      className={`mt-8 min-h-14 w-full flex-row items-center justify-center rounded-2xl bg-primary-300 px-6 ${
        isReturning ? "opacity-60" : ""
      }`}
    >
      {isReturning ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <Text className="font-rubik-semibold text-base text-white">
          Return to sign in
        </Text>
      )}
    </TouchableOpacity>
  </View>
);

const Profile = () => {
  const { action, returnToSignIn, signOut, status, user } = useAuth();

  if (status === "guest") {
    return (
      <SafeAreaView className="h-full bg-white">
        <GuestProfile
          isReturning={action === "guest"}
          onReturnToSignIn={() => void returnToSignIn()}
        />
      </SafeAreaView>
    );
  }

  if (status !== "authenticated" || user === null) {
    return null;
  }

  const displayName = user.displayName ?? "Relativity Explorer";
  const email = user.email ?? "No email address available";

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
          {user.photoURL === null ? (
            <View className="size-44 items-center justify-center rounded-full bg-primary-100">
              <Text className="font-rubik-bold text-5xl text-primary-300">
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          ) : (
            <Image
              accessibilityLabel={`${displayName} profile photo`}
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
      </ScrollView>
    </SafeAreaView>
  );
};

export default Profile;
