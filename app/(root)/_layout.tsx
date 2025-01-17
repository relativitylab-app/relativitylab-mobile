import { Redirect, Slot } from "expo-router";
import { ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// import { useGlobalContext } from "@/lib/global-provider";
import { useGlobal } from "@/lib/custom-global";

export default function AppLayout() {
  const { isLogged } = useGlobal();

  // if (loading) {
  //   return (
  //     <SafeAreaView className="bg-white h-full flex justify-center items-center">
  //       <ActivityIndicator className="text-primary-300" size="large" />
  //     </SafeAreaView>
  //   );
  // }

  if (!isLogged) {
    return <Redirect href="/sign-in" />;
  }

  return <Slot />;
}
