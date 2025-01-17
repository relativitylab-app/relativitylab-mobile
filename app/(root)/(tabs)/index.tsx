import {
  Image,
  Text,
  View,
  TouchableOpacity
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { user, menu } from "@/constants/data";
import images from "@/constants/image";
import { Redirect, Link } from "expo-router";

export default function Index() {
  return (
    <SafeAreaView className="h-full bg-white">
      <View className="px-5">
        <View className="flex flex-row items-center justify-between mt-5">
          <View className="flex flex-row">
            <Image
              source={user.image}
              className="size-12 rounded-full"
            />

            <View className="flex flex-col items-start ml-2 justify-center">
              <Text className="text-xs font-rubik text-black-100">
                Good Morning
              </Text>
              <Text className="text-base font-rubik-medium text-black-300">
                {user.name}
              </Text>
            </View>
          </View>
        </View>
        <View className="my-5">
            <TouchableOpacity
              className="flex flex-col items-start w-full h-80 relative my-2"
            > 
              
              <Image source={menu[0].image} className="size-full rounded-2xl" />
        
              <Image
                source={images.cardGradient}
                className="size-full rounded-2xl absolute bottom-0"
              />
        
              <View className="flex flex-col items-start absolute bottom-5 inset-x-5">
                <Link href="/playground">
                  <Text
                    className="text-xl font-rubik-extrabold text-white"
                    numberOfLines={1}
                  >
                    {menu[0].name}
                  </Text>
                </Link>
              </View>
              
            </TouchableOpacity>
            <TouchableOpacity
              className="flex flex-col items-start w-full h-80 relative my-2"
            >
              <Image source={menu[1].image} className="size-full rounded-2xl" />
        
              <Image
                source={images.cardGradient}
                className="size-full rounded-2xl absolute bottom-0"
              />
        
              <View className="flex flex-col items-start absolute bottom-5 inset-x-5">
                <Link href="/quiz">
                  <Text
                    className="text-xl font-rubik-extrabold text-white"
                    numberOfLines={1}
                  >
                    {menu[1].name}
                  </Text>
                </Link>
              </View>
            </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
