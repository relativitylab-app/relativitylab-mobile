import {
  Alert,
  Image,
  ImageSourcePropType,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Redirect } from "expo-router";

// import { logout } from "@/lib/appwrite";
// import { useGlobalContext } from "@/lib/global-provider";
import { useGlobal } from "@/lib/custom-global";

import icons from "@/constants/icons";
import { user } from "@/constants/data";

interface SettingsItemProp {
  icon: ImageSourcePropType;
  title: string;
  onPress?: () => void;
  textStyle?: string;
  showArrow?: boolean;
}

const SettingsItem = ({
  icon,
  title,
  onPress,
  textStyle,
  showArrow = true,
}: SettingsItemProp) => (
  <TouchableOpacity
    onPress={onPress}
    className="flex flex-row items-center justify-between py-3"
  >
    <View className="flex flex-row items-center gap-3">
      <Image source={icon} className="size-6" />
      <Text className={`text-lg font-rubik-medium text-black-300 ${textStyle}`}>
        {title}
      </Text>
    </View>

    {showArrow && <Image source={icons.rightArrow} className="size-5" />}
  </TouchableOpacity>
);

const Profile = () => {
  // const { user, refetch } = useGlobalContext();
  const { isLogged, logOut } = useGlobal();
  
  if (!isLogged) {
    return <Redirect href="/sign-in" />;
  }

  const handleLogout = async () => {
    logOut();
    return <Redirect href="/sign-in" />;
    // const result = await logout();
    // if (result) {
    //   Alert.alert("Success", "Logged out successfully");
    //   refetch();
    // } else {
    //   Alert.alert("Error", "Failed to logout");
    // }
  };

  return (
    <SafeAreaView className="h-full bg-white">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-32 px-7"
      >
        <View className="flex flex-row items-center justify-between mt-5">
          <Text className="text-xl font-rubik-bold">Profile</Text>
        </View>

        <View className="flex flex-row justify-center mt-5">
          <View className="flex flex-col items-center relative mt-5">
            <Image
              source={user.image}
              className="size-44 relative rounded-full"
            />

            <Text className="text-2xl font-rubik-bold mt-2">{user.name}</Text>
          </View>
        </View>

        <View className="flex flex-col border-t mt-5 pt-5 border-primary-200">
          <SettingsItem
            icon={icons.logout}
            title="Logout"
            textStyle="text-danger"
            showArrow={false}
            onPress={handleLogout}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Profile;