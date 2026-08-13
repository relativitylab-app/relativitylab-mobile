import React from "react";
import {
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  LoaderCircle,
  Send,
  XCircle,
  type LucideIcon,
} from "lucide-react-native";

import { Question } from "@/domain/questions";
import { quizStrings } from "@/constants/strings";

export type AnswerFeedback =
  | "idle"
  | "blank"
  | "invalid"
  | "incorrect"
  | "correct"
  | "saving"
  | "saveError";

interface NumericQuestionCardProps {
  readonly question: Question;
  readonly questionIndex: number;
  readonly questionCount: number;
  readonly value: string;
  readonly feedback: AnswerFeedback;
  readonly solved: boolean;
  readonly canSubmit: boolean;
  readonly canGoPrevious: boolean;
  readonly canGoNext: boolean;
  readonly onChangeAnswer: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}

const feedbackText: Record<AnswerFeedback, string | null> = {
  idle: null,
  blank: quizStrings.blankAnswer,
  invalid: quizStrings.invalidAnswer,
  incorrect: quizStrings.incorrect,
  correct: quizStrings.correct,
  saving: quizStrings.saving,
  saveError: quizStrings.saveError,
};

const feedbackClassName: Record<AnswerFeedback, string> = {
  idle: "text-black-200",
  blank: "text-amber-700",
  invalid: "text-amber-700",
  incorrect: "text-danger",
  correct: "text-green-700",
  saving: "text-primary-300",
  saveError: "text-danger",
};

// Shape, not colour, has to carry the correct/incorrect distinction.
const feedbackIcon: Record<AnswerFeedback, LucideIcon | null> = {
  idle: null,
  blank: AlertCircle,
  invalid: AlertCircle,
  incorrect: XCircle,
  correct: CheckCircle2,
  saving: LoaderCircle,
  saveError: AlertTriangle,
};

const feedbackIconColor: Record<AnswerFeedback, string> = {
  idle: "#666876",
  blank: "#b45309",
  invalid: "#b45309",
  incorrect: "#f75555",
  correct: "#15803d",
  saving: "#0061ff",
  saveError: "#f75555",
};

export const NumericQuestionCard = ({
  canGoNext,
  canGoPrevious,
  canSubmit,
  feedback,
  onChangeAnswer,
  onNext,
  onPrevious,
  onSubmit,
  question,
  questionCount,
  questionIndex,
  solved,
  value,
}: NumericQuestionCardProps) => {
  const displayNumber = questionIndex + 1;
  const statusLabel = solved ? quizStrings.solved : quizStrings.unsolved;
  const statusColor = solved ? "#16a34a" : "#666876";
  const currentFeedback = solved && feedback === "idle" ? "correct" : feedback;
  const message = feedbackText[currentFeedback];
  const FeedbackIcon = feedbackIcon[currentFeedback];

  return (
    <View className="rounded-lg border border-primary-200 bg-white p-5">
      <View className="flex-row items-start justify-between gap-4">
        <View className="min-w-0 flex-1">
          <Text className="font-rubik-medium text-sm text-black-200">
            Question {displayNumber} of {questionCount}
          </Text>
          <Text className="mt-1 font-rubik-bold text-lg text-black-300">
            Display number {question.number}
          </Text>
        </View>
        <View
          accessibilityLabel={`Question status: ${statusLabel}`}
          className="min-h-11 flex-row items-center gap-2 rounded-lg bg-primary-100 px-3"
        >
          {solved ? (
            <CheckCircle2 size={18} color={statusColor} />
          ) : (
            <Circle size={18} color={statusColor} />
          )}
          <Text className="font-rubik-medium text-sm text-black-300">
            {statusLabel}
          </Text>
        </View>
      </View>

      <Text className="mt-6 font-rubik-medium text-xl leading-8 text-black-300">
        {question.question}
      </Text>

      <TextInput
        accessibilityLabel={`Answer for question ${displayNumber}`}
        className="mt-6 min-h-14 rounded-lg border border-primary-200 px-4 font-rubik text-lg text-black-300"
        inputMode="decimal"
        keyboardType={
          Platform.OS === "ios" ? "numbers-and-punctuation" : "decimal-pad"
        }
        onChangeText={onChangeAnswer}
        placeholder="Numeric answer"
        returnKeyType="done"
        value={value}
      />

      {message !== null && (
        <View className="mt-3 flex-row items-center gap-2">
          {FeedbackIcon !== null && (
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              testID={`answer-feedback-icon-${currentFeedback}`}
            >
              <FeedbackIcon
                size={18}
                color={feedbackIconColor[currentFeedback]}
              />
            </View>
          )}
          <Text
            accessibilityLiveRegion="polite"
            className={`min-w-0 flex-1 font-rubik-medium text-sm ${feedbackClassName[currentFeedback]}`}
          >
            {message}
          </Text>
        </View>
      )}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={quizStrings.submit}
        accessibilityState={{ disabled: !canSubmit }}
        disabled={!canSubmit}
        onPress={onSubmit}
        className={`mt-5 min-h-14 flex-row items-center justify-center gap-2 rounded-lg px-5 ${
          canSubmit ? "bg-primary-300" : "bg-black-100"
        }`}
      >
        <Send size={18} color="#ffffff" />
        <Text className="font-rubik-semibold text-base text-white">
          {quizStrings.submit}
        </Text>
      </TouchableOpacity>

      <View className="mt-5 flex-row gap-3">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={quizStrings.previous}
          accessibilityState={{ disabled: !canGoPrevious }}
          disabled={!canGoPrevious}
          onPress={onPrevious}
          className={`min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-lg border px-4 ${
            canGoPrevious ? "border-primary-300" : "border-primary-200 opacity-50"
          }`}
        >
          <ArrowLeft size={18} color="#0061ff" />
          <Text className="font-rubik-medium text-base text-primary-300">
            {quizStrings.previous}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={quizStrings.next}
          accessibilityState={{ disabled: !canGoNext }}
          disabled={!canGoNext}
          onPress={onNext}
          className={`min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-lg border px-4 ${
            canGoNext ? "border-primary-300" : "border-primary-200 opacity-50"
          }`}
        >
          <Text className="font-rubik-medium text-base text-primary-300">
            {quizStrings.next}
          </Text>
          <ArrowRight size={18} color="#0061ff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};
