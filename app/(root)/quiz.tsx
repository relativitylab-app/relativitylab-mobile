import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useLocalSearchParams, useRouter } from "expo-router";

import {
  AnswerFeedback,
  NumericQuestionCard,
  QuestionStatusBanner,
} from "@/components/question";
import { quizStrings } from "@/constants/strings";
import {
  Question,
  isExactCorrectAnswer,
  parseUserAnswer,
} from "@/domain/questions";
import { QuestionState } from "@/infrastructure/firebase/questionRepository";
import { useProgress } from "@/providers/ProgressProvider";
import { useQuestions } from "@/providers/QuestionProvider";

interface QuestionAnswerState {
  readonly value: string;
  readonly feedback: AnswerFeedback;
}

const emptyAnswerState: QuestionAnswerState = {
  value: "",
  feedback: "idle",
};

const firstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const findQuestionIndex = (
  questions: readonly Question[],
  questionId: string | undefined,
): number => {
  if (questionId === undefined) {
    return 0;
  }

  const index = questions.findIndex((question) => question.id === questionId);

  return index >= 0 ? index : 0;
};

const readySourceLabel = (
  source: "current" | "firestore-cache" | "fallback-cache",
): string => {
  if (source === "current") {
    return quizStrings.current;
  }

  return quizStrings.cached;
};

type ReadyQuestionState = Extract<QuestionState, { readonly kind: "ready" }>;

export default function Quiz() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    readonly id?: string | string[];
    readonly questionId?: string | string[];
  }>();
  const { retry, state } = useQuestions();
  const {
    recordSolved,
    retrySync,
    solvedQuestionIds,
    syncStatus,
  } = useProgress();
  const queryQuestionId = firstParam(params.id) ?? firstParam(params.questionId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, QuestionAnswerState>>({});
  const inFlightSubmitsRef = useRef(new Map<string, Promise<void>>());

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/");
  };

  const questions = state.kind === "ready" ? state.questions : [];
  const currentQuestion = questions[currentIndex] ?? null;
  const currentAnswer =
    currentQuestion === null ? emptyAnswerState : answers[currentQuestion.id] ?? emptyAnswerState;

  useEffect(() => {
    if (state.kind !== "ready") {
      return;
    }

    setCurrentIndex(findQuestionIndex(state.questions, queryQuestionId));
  }, [queryQuestionId, state]);

  const solvedCount = questions.filter((question) =>
    solvedQuestionIds.has(question.id),
  ).length;

  const updateQuestionAnswer = (
    questionId: string,
    update: QuestionAnswerState,
  ): void => {
    setAnswers((current) => ({
      ...current,
      [questionId]: update,
    }));
  };

  const goToIndex = (nextIndex: number): void => {
    const nextQuestion = questions[nextIndex];

    if (nextQuestion === undefined) {
      return;
    }

    setCurrentIndex(nextIndex);
    router.setParams({ id: nextQuestion.id });
  };

  const submitCurrentAnswer = (): void => {
    if (currentQuestion === null) {
      return;
    }

    const answerValue = currentAnswer.value;
    const parsedAnswer = parseUserAnswer(answerValue);

    if (answerValue.trim() === "") {
      updateQuestionAnswer(currentQuestion.id, {
        value: answerValue,
        feedback: "blank",
      });
      return;
    }

    if (parsedAnswer === null) {
      updateQuestionAnswer(currentQuestion.id, {
        value: answerValue,
        feedback: "invalid",
      });
      return;
    }

    if (!isExactCorrectAnswer(currentQuestion.answer, answerValue)) {
      updateQuestionAnswer(currentQuestion.id, {
        value: answerValue,
        feedback: "incorrect",
      });
      return;
    }

    const existingSubmit = inFlightSubmitsRef.current.get(currentQuestion.id);

    if (existingSubmit !== undefined) {
      return;
    }

    updateQuestionAnswer(currentQuestion.id, {
      value: answerValue,
      feedback: "saving",
    });

    const submit = recordSolved(currentQuestion.id)
      .then(() => {
        updateQuestionAnswer(currentQuestion.id, {
          value: answerValue,
          feedback: "correct",
        });
      })
      .catch(() => {
        updateQuestionAnswer(currentQuestion.id, {
          value: answerValue,
          feedback: "saveError",
        });
      })
      .finally(() => {
        inFlightSubmitsRef.current.delete(currentQuestion.id);
      });

    inFlightSubmitsRef.current.set(currentQuestion.id, submit);
  };

  const renderReady = (readyState: ReadyQuestionState) => {
    if (currentQuestion === null) {
      return (
        <QuestionStatusBanner
          actionLabel={quizStrings.retryQuestions}
          label={quizStrings.dataError}
          onAction={() => void retry()}
          tone="danger"
        />
      );
    }

    const isSolved = solvedQuestionIds.has(currentQuestion.id);
    const feedback = currentAnswer.feedback;
    const canSubmit =
      feedback !== "saving" &&
      currentAnswer.value.trim() !== "" &&
      parseUserAnswer(currentAnswer.value) !== null;

    return (
      <View className="gap-4">
        <QuestionStatusBanner
          actionLabel={
            readyState.refreshError ? quizStrings.retryQuestions : undefined
          }
          label={readySourceLabel(readyState.source)}
          loading={readyState.refreshing}
          onAction={readyState.refreshError ? () => void retry() : undefined}
          tone={readyState.source === "current" ? "success" : "warning"}
        />

        {syncStatus === "failed" && (
          <QuestionStatusBanner
            actionLabel={quizStrings.retryProgress}
            label={quizStrings.saveError}
            onAction={() => void retrySync()}
            tone="danger"
          />
        )}
        {syncStatus === "pending" && (
          <QuestionStatusBanner
            label={quizStrings.syncPending}
            tone="warning"
          />
        )}

        <View className="rounded-lg bg-primary-100 px-4 py-3">
          <Text className="font-rubik-medium text-sm text-black-300">
            {solvedCount} of {questions.length} solved
          </Text>
        </View>

        <NumericQuestionCard
          canGoNext={currentIndex < questions.length - 1}
          canGoPrevious={currentIndex > 0}
          canSubmit={canSubmit}
          feedback={feedback}
          onChangeAnswer={(value) =>
            updateQuestionAnswer(currentQuestion.id, {
              value,
              feedback:
                value.trim() === ""
                  ? "blank"
                  : parseUserAnswer(value) === null
                    ? "invalid"
                    : "idle",
            })
          }
          onNext={() => goToIndex(currentIndex + 1)}
          onPrevious={() => goToIndex(currentIndex - 1)}
          onSubmit={submitCurrentAnswer}
          question={currentQuestion}
          questionCount={questions.length}
          questionIndex={currentIndex}
          solved={isSolved}
          value={currentAnswer.value}
        />
      </View>
    );
  };

  const renderContent = () => {
    if (state.kind === "loading") {
      return <QuestionStatusBanner label={quizStrings.loading} loading />;
    }

    if (state.kind === "empty-offline") {
      return (
        <View className="gap-3">
          <QuestionStatusBanner
            actionLabel={quizStrings.retryQuestions}
            label={quizStrings.firstRunOffline}
            onAction={() => void retry()}
            tone="warning"
          />
          <Link href="/" asChild>
            <Text
              accessibilityRole="link"
              accessibilityLabel={quizStrings.home}
              className="min-h-11 text-center font-rubik-medium text-base leading-10 text-primary-300"
            >
              {quizStrings.home}
            </Text>
          </Link>
        </View>
      );
    }

    if (state.kind === "error") {
      return (
        <QuestionStatusBanner
          actionLabel={state.retryable ? quizStrings.retryQuestions : undefined}
          label={
            state.reason === "data" ? quizStrings.dataError : quizStrings.networkError
          }
          onAction={state.retryable ? () => void retry() : undefined}
          tone="danger"
        />
      );
    }

    return renderReady(state);
  };

  return (
    <SafeAreaView className="h-full bg-white">
      <Pressable
        accessibilityHint="Returns to the previous screen, or Home when no history is available."
        accessibilityLabel={quizStrings.back}
        accessibilityRole="button"
        className="mx-5 mt-3 min-h-12 self-start justify-center rounded-lg border border-primary-200 px-4"
        onPress={handleBack}
      >
        <Text className="font-rubik-medium text-base text-primary-300">
          ‹ {quizStrings.back}
        </Text>
      </Pressable>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="px-5 pb-32 pt-5"
        >
          <Text className="font-rubik-bold text-3xl text-black-300">Quiz</Text>
          <Text className="mt-2 font-rubik text-base leading-6 text-black-200">
            Enter the exact numeric answer for each question.
          </Text>
          <View className="mt-6">{renderContent()}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
