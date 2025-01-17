import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { login } from "@/lib/appwrite";
import { Redirect } from "expo-router";
// import { useGlobalContext } from "@/lib/global-provider";
import { useGlobal } from "@/lib/custom-global";
import icons from "@/constants/icons";
import images from "@/constants/image";

const Auth = () => {
  // const { refetch, loading, isLogged } = useGlobalContext();
  const { isLogged, logIn } = useGlobal();

  // if (!loading && isLogged) return <Redirect href="/" />;
  if (isLogged) return <Redirect href="/" />;

  const handleLogin = async () => {
    logIn();
    const result = await login();
    if (result) {
      // refetch();
      console.log('Login Success');
    } else {

      // Alert.alert("Error", "Failed to login");
    }
  };

  return (
    <SafeAreaView className="bg-white h-full">
      <ScrollView
        contentContainerStyle={{
          height: "100%",
        }}
      >
        <Image
          source={images.onboarding}
          className="w-full h-4/6"
          resizeMode="contain"
        />

        <View className="px-10">
          <Text className="text-3xl font-rubik-bold text-black-300 text-center mt-2">
            RelativityLab: {"\n"}
            <Text className="text-primary-300">Warp Space, Bend Time.</Text>
          </Text>

          <Text className="text-lg font-rubik text-black-200 text-center mt-12">
            Login to RelativityLab with Google
          </Text>

          <TouchableOpacity
            onPress={handleLogin}
            className="bg-white shadow-md shadow-zinc-300 rounded-full w-full py-4 mt-5"
          >
            <View className="flex flex-row items-center justify-center">
              <Image
                source={icons.google}
                className="w-5 h-5"
                resizeMode="contain"
              />
              <Text className="text-lg font-rubik-medium text-black-300 ml-2">
                Continue with Google
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Auth;