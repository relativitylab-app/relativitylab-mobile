import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { Atom, Calculator } from "lucide-react-native";

import { homeStrings } from "@/constants/strings";
import { useAuth } from "@/providers/AuthProvider";

const HomeEntry = ({
  description,
  href,
  icon,
  title,
}: {
  readonly description: string;
  readonly href: "/playground" | "/quiz";
  readonly icon: React.ReactNode;
  readonly title: string;
}) => (
  <Link href={href} asChild>
    <TouchableOpacity
      accessibilityRole="button"
      className="min-h-28 flex-row items-center gap-4 rounded-lg border border-primary-200 bg-white px-5 py-4"
    >
      <View className="size-12 items-center justify-center rounded-lg bg-primary-100">
        {icon}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-rubik-bold text-xl text-black-300">{title}</Text>
        <Text className="mt-1 font-rubik text-sm leading-5 text-black-200">
          {description}
        </Text>
      </View>
    </TouchableOpacity>
  </Link>
);

export default function Index() {
  const { status, user } = useAuth();
  const displayName =
    status === "authenticated"
      ? user?.displayName ?? user?.email ?? homeStrings.greetingFallback
      : "Guest";

  return (
    <SafeAreaView className="h-full bg-white">
      <View className="px-5 pt-5">
        <Text className="font-rubik text-sm text-black-200">Welcome back</Text>
        <Text className="mt-1 font-rubik-bold text-3xl text-black-300">
          {displayName}
        </Text>

        <View className="mt-8 gap-4">
          <HomeEntry
            description={homeStrings.labDescription}
            href="/playground"
            icon={<Atom size={24} color="#0061ff" />}
            title={homeStrings.labTitle}
          />
          <HomeEntry
            description={homeStrings.quizDescription}
            href="/quiz"
            icon={<Calculator size={24} color="#0061ff" />}
            title={homeStrings.quizTitle}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
