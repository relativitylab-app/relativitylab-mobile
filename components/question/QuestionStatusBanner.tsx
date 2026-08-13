import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  RefreshCw,
} from "lucide-react-native";

export type QuestionStatusTone = "info" | "success" | "warning" | "danger";

interface QuestionStatusBannerProps {
  readonly label: string;
  readonly tone?: QuestionStatusTone;
  readonly loading?: boolean;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}

const toneClasses: Record<QuestionStatusTone, string> = {
  info: "border-primary-200 bg-primary-100",
  success: "border-green-200 bg-green-50",
  warning: "border-amber-200 bg-amber-50",
  danger: "border-red-200 bg-red-50",
};

const iconColor: Record<QuestionStatusTone, string> = {
  info: "#0061ff",
  success: "#16a34a",
  warning: "#b45309",
  danger: "#dc2626",
};

const StatusIcon = ({
  loading,
  tone,
}: {
  readonly loading: boolean;
  readonly tone: QuestionStatusTone;
}) => {
  if (loading) {
    return <ActivityIndicator color={iconColor[tone]} />;
  }

  if (tone === "success") {
    return <CheckCircle2 size={20} color={iconColor[tone]} />;
  }

  if (tone === "info") {
    return <CloudOff size={20} color={iconColor[tone]} />;
  }

  return <AlertTriangle size={20} color={iconColor[tone]} />;
};

export const QuestionStatusBanner = ({
  actionLabel,
  label,
  loading = false,
  onAction,
  tone = "info",
}: QuestionStatusBannerProps) => (
  <View
    accessibilityLiveRegion="polite"
    className={`w-full flex-row items-center gap-3 rounded-lg border px-4 py-3 ${toneClasses[tone]}`}
  >
    <StatusIcon loading={loading} tone={tone} />
    <Text className="min-w-0 flex-1 font-rubik text-sm leading-5 text-black-300">
      {label}
    </Text>
    {actionLabel !== undefined && onAction !== undefined && (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        onPress={onAction}
        className="min-h-11 min-w-11 items-center justify-center rounded-lg bg-white px-3"
      >
        <RefreshCw size={18} color="#0061ff" />
      </TouchableOpacity>
    )}
  </View>
);
