import { Redirect, Slot } from "expo-router";

import { useAuth } from "@/providers/AuthProvider";

export default function AppLayout() {
  const { status } = useAuth();

  if (status === "initializing") {
    return null;
  }

  if (status === "signedOut") {
    return <Redirect href="/sign-in" />;
  }

  return <Slot />;
}
