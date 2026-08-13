import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";

import {
  QuestionRepository,
  QuestionState,
} from "@/infrastructure/firebase/questionRepository";
import {
  QuestionContextValue,
  QuestionProvider,
  useQuestions,
} from "@/providers/QuestionProvider";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const createRepository = () => {
  let listener: ((state: QuestionState) => void) | null = null;
  const unsubscribe = jest.fn();
  const refresh = jest.fn(async () => undefined);
  const repository: QuestionRepository = {
    subscribe: jest.fn((next) => {
      listener = next;
      next({ kind: "loading" });
      return unsubscribe;
    }),
    refresh,
  };

  return {
    repository,
    refresh,
    unsubscribe,
    emit: (state: QuestionState) => listener?.(state),
  };
};

const renderQuestions = async (repository: QuestionRepository) => {
  const values: QuestionContextValue[] = [];
  const Probe = () => {
    values.push(useQuestions());
    return null;
  };
  let renderer: ReactTestRenderer;

  await act(async () => {
    renderer = create(
      <QuestionProvider repository={repository}>
        <Probe />
      </QuestionProvider>,
    );
    await flush();
  });

  return { renderer: renderer!, values };
};

describe("QuestionProvider", () => {
  it("owns one repository subscription and forwards state updates", async () => {
    const { repository, emit, unsubscribe } = createRepository();
    const { renderer, values } = await renderQuestions(repository);
    const ready: QuestionState = {
      kind: "ready",
      questions: [{ id: "q1", number: 1, question: "One", answer: 1 }],
      source: "current",
      invalidCount: 0,
      cachedAt: "2026-08-13T00:00:00.000Z",
      refreshing: false,
      refreshError: false,
    };

    act(() => emit(ready));
    expect(repository.subscribe).toHaveBeenCalledTimes(1);
    expect(values.at(-1)?.state).toEqual(ready);

    act(() => renderer.unmount());
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("exposes retry without resetting the current provider state", async () => {
    const { repository, emit, refresh } = createRepository();
    const { values } = await renderQuestions(repository);
    const ready: QuestionState = {
      kind: "ready",
      questions: [{ id: "saved", number: 2, question: "Saved", answer: 2 }],
      source: "fallback-cache",
      invalidCount: 0,
      cachedAt: "2026-08-12T00:00:00.000Z",
      refreshing: false,
      refreshError: false,
    };
    act(() => emit(ready));

    await act(async () => {
      await values.at(-1)!.retry();
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(values.at(-1)?.state).toEqual(ready);
  });

});
