import React from "react";
import { Text, TextInput } from "react-native";
import {
  act,
  create,
  ReactTestInstance,
  ReactTestRenderer,
} from "react-test-renderer";

type QuestionState =
  | { readonly kind: "loading" }
  | {
      readonly kind: "ready";
      readonly questions: readonly {
        readonly id: string;
        readonly number: number;
        readonly question: string;
        readonly answer: number;
      }[];
      readonly source: "current" | "firestore-cache" | "fallback-cache";
      readonly invalidCount: number;
      readonly cachedAt: string | null;
      readonly refreshing: boolean;
      readonly refreshError: boolean;
    }
  | { readonly kind: "empty-offline"; readonly retryable: true }
  | {
      readonly kind: "error";
      readonly reason: "data" | "network";
      readonly retryable: boolean;
    };

const retry = jest.fn(async () => undefined);
const retrySync = jest.fn(async () => undefined);
const recordSolved = jest.fn(async () => undefined);
const setParams = jest.fn();
const back = jest.fn();
const replace = jest.fn();
const LinkMock = ({ children }: { readonly children: React.ReactNode }) => <>{children}</>;
let questionState: QuestionState = { kind: "loading" };
let solvedQuestionIds = new Set<string>();
let pendingQuestionIds = new Set<string>();
let syncStatus: "pending" | "synced" | "failed" = "synced";
let progressSource: "guest" | "firebase" = "guest";
let routeParams: { readonly id?: string } = {};
let canGoBack = true;

const questions = [
  {
    id: "length-contraction",
    number: 1,
    question: "What is the contracted length?",
    answer: 64,
  },
  {
    id: "time-dilation",
    number: 2,
    question: "How many minutes pass?",
    answer: 36,
  },
] as const;

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const collectText = (node: unknown): string[] => {
  if (typeof node === "string") {
    return [node];
  }

  if (typeof node === "number") {
    return [String(node)];
  }

  if (Array.isArray(node)) {
    return node.flatMap(collectText);
  }

  if (typeof node === "object" && node !== null && "children" in node) {
    return collectText((node as { readonly children?: unknown }).children);
  }

  return [];
};

const textContent = (renderer: ReactTestRenderer): string[] =>
  renderer.root
    .findAllByType(Text)
    .map((node) => collectText(node.props.children).join(""));

const findByAccessibilityLabel = (
  renderer: ReactTestRenderer,
  label: string,
): ReactTestInstance =>
  renderer.root.find((node) => node.props.accessibilityLabel === label);

const findAllByTestId = (
  renderer: ReactTestRenderer,
  testID: string,
): ReactTestInstance[] =>
  renderer.root.findAll(
    (node) => typeof node.type === "string" && node.props.testID === testID,
  );

const loadQuiz = () => {
  jest.resetModules();
  jest.doMock("react", () => React);
  jest.doMock("expo-router", () => ({
    Link: LinkMock,
    useLocalSearchParams: () => routeParams,
    useRouter: () => ({
      back,
      canGoBack: () => canGoBack,
      replace,
      setParams,
    }),
  }));
  jest.doMock("@/providers/QuestionProvider", () => ({
    useQuestions: () => ({ state: questionState, retry }),
  }));
  jest.doMock("@/providers/ProgressProvider", () => ({
    useProgress: () => ({
      source: progressSource,
      solvedQuestionIds,
      pendingQuestionIds,
      syncStatus,
      isLoading: false,
      recordSolved,
      retrySync,
    }),
  }));

  return require("../app/(root)/quiz").default as React.ComponentType;
};

describe("quiz UI", () => {
  const renderers: ReactTestRenderer[] = [];

  const render = (component: React.ReactElement): ReactTestRenderer => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(component);
    });
    renderers.push(renderer);
    return renderer;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    questionState = { kind: "loading" };
    solvedQuestionIds = new Set();
    pendingQuestionIds = new Set();
    syncStatus = "synced";
    progressSource = "guest";
    routeParams = {};
    canGoBack = true;
  });

  afterEach(() => {
    act(() => {
      renderers.splice(0).forEach((renderer) => renderer.unmount());
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("renders loading, cached, first-run-offline, and data-error states", () => {
    const Quiz = loadQuiz();
    let renderer = render(<Quiz />);
    expect(textContent(renderer)).toContain("Loading questions...");
    expect(findByAccessibilityLabel(renderer, "Back")).toBeDefined();

    questionState = {
      kind: "ready",
      questions,
      source: "fallback-cache",
      invalidCount: 0,
      cachedAt: "2026-08-13T00:00:00.000Z",
      refreshing: false,
      refreshError: false,
    };
    renderer = render(<Quiz />);
    expect(textContent(renderer)).toEqual(
      expect.arrayContaining(["Using saved questions.", "Question 1 of 2"]),
    );

    questionState = { kind: "empty-offline", retryable: true };
    renderer = render(<Quiz />);
    expect(textContent(renderer)).toContain(
      "Questions are not available offline yet",
    );
    expect(findByAccessibilityLabel(renderer, "Retry question load")).toBeDefined();
    expect(findByAccessibilityLabel(renderer, "Home")).toBeDefined();

    questionState = { kind: "error", reason: "data", retryable: true };
    renderer = render(<Quiz />);
    expect(textContent(renderer)).toContain("Question data could not be loaded.");
  });

  it("uses navigation history for Back and falls back to Home", () => {
    const Quiz = loadQuiz();
    const renderer = render(<Quiz />);
    act(() => findByAccessibilityLabel(renderer, "Back").props.onPress());
    expect(back).toHaveBeenCalledTimes(1);

    canGoBack = false;
    act(() => findByAccessibilityLabel(renderer, "Back").props.onPress());
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("uses deep-linked question IDs and retains editable incorrect answers", async () => {
    routeParams = { id: "time-dilation" };
    questionState = {
      kind: "ready",
      questions,
      source: "current",
      invalidCount: 0,
      cachedAt: null,
      refreshing: false,
      refreshError: false,
    };
    const Quiz = loadQuiz();
    const renderer = render(<Quiz />);

    await act(async () => {
      await flush();
    });

    expect(textContent(renderer)).toEqual(
      expect.arrayContaining(["Question 2 of 2", "How many minutes pass?"]),
    );

    const input = renderer.root.findByType(TextInput);
    act(() => {
      input.props.onChangeText("35");
    });
    act(() => {
      findByAccessibilityLabel(renderer, "Submit answer").props.onPress();
    });

    expect(recordSolved).not.toHaveBeenCalled();
    expect(textContent(renderer)).toContain(
      "Not quite. Edit your answer and try again.",
    );
    expect(renderer.root.findByType(TextInput).props.value).toBe("35");
  });

  it("records exact numeric answers once and never discloses the correct answer", async () => {
    questionState = {
      kind: "ready",
      questions,
      source: "current",
      invalidCount: 0,
      cachedAt: null,
      refreshing: false,
      refreshError: false,
    };
    const Quiz = loadQuiz();
    const renderer = render(<Quiz />);
    const input = renderer.root.findByType(TextInput);

    act(() => {
      input.props.onChangeText("64");
    });

    await act(async () => {
      const submit = findByAccessibilityLabel(renderer, "Submit answer");
      submit.props.onPress();
      submit.props.onPress();
      await flush();
    });

    expect(recordSolved).toHaveBeenCalledTimes(1);
    expect(recordSolved).toHaveBeenCalledWith("length-contraction");
    expect(textContent(renderer)).toContain("Correct. Progress recorded.");
    expect(textContent(renderer).join(" ")).not.toContain("answer is 64");
  });

  it("keeps invalid input disabled with adjacent guidance and accepts negative input on iOS", () => {
    questionState = {
      kind: "ready",
      questions,
      source: "current",
      invalidCount: 0,
      cachedAt: null,
      refreshing: false,
      refreshError: false,
    };
    const Quiz = loadQuiz();
    const renderer = render(<Quiz />);
    const input = renderer.root.findByType(TextInput);

    expect(input.props.keyboardType).toBe("numbers-and-punctuation");

    act(() => {
      input.props.onChangeText("not-a-number");
    });

    const submit = findByAccessibilityLabel(renderer, "Submit answer");
    expect(submit.props.accessibilityState).toEqual({ disabled: true });
    expect(textContent(renderer)).toContain("Enter a valid number.");
  });

  it("renders a distinct icon beside correct and incorrect feedback text", async () => {
    questionState = {
      kind: "ready",
      questions,
      source: "current",
      invalidCount: 0,
      cachedAt: null,
      refreshing: false,
      refreshError: false,
    };
    const Quiz = loadQuiz();
    const renderer = render(<Quiz />);

    expect(findAllByTestId(renderer, "answer-feedback-icon-correct")).toHaveLength(0);
    expect(findAllByTestId(renderer, "answer-feedback-icon-incorrect")).toHaveLength(0);

    act(() => {
      renderer.root.findByType(TextInput).props.onChangeText("63");
    });
    act(() => {
      findByAccessibilityLabel(renderer, "Submit answer").props.onPress();
    });

    const incorrectIcons = findAllByTestId(renderer, "answer-feedback-icon-incorrect");
    expect(incorrectIcons).toHaveLength(1);
    expect(incorrectIcons[0].props.accessibilityElementsHidden).toBe(true);
    expect(incorrectIcons[0].props.importantForAccessibility).toBe(
      "no-hide-descendants",
    );
    expect(textContent(renderer)).toContain(
      "Not quite. Edit your answer and try again.",
    );
    expect(findAllByTestId(renderer, "answer-feedback-icon-correct")).toHaveLength(0);

    act(() => {
      renderer.root.findByType(TextInput).props.onChangeText("64");
    });
    await act(async () => {
      findByAccessibilityLabel(renderer, "Submit answer").props.onPress();
      await flush();
    });

    const correctIcons = findAllByTestId(renderer, "answer-feedback-icon-correct");
    expect(correctIcons).toHaveLength(1);
    expect(textContent(renderer)).toContain("Correct. Progress recorded.");
    expect(findAllByTestId(renderer, "answer-feedback-icon-incorrect")).toHaveLength(0);
  });

  it("renders a validation icon beside blank and invalid answer guidance", () => {
    questionState = {
      kind: "ready",
      questions,
      source: "current",
      invalidCount: 0,
      cachedAt: null,
      refreshing: false,
      refreshError: false,
    };
    const Quiz = loadQuiz();
    const renderer = render(<Quiz />);

    act(() => {
      renderer.root.findByType(TextInput).props.onChangeText("not-a-number");
    });

    expect(findAllByTestId(renderer, "answer-feedback-icon-invalid")).toHaveLength(1);
    expect(textContent(renderer)).toContain("Enter a valid number.");

    act(() => {
      renderer.root.findByType(TextInput).props.onChangeText("");
    });

    expect(findAllByTestId(renderer, "answer-feedback-icon-blank")).toHaveLength(1);
    expect(textContent(renderer)).toContain("Enter an answer before submitting.");
  });

  it("keeps the feedback text in a polite live region alongside its icon", () => {
    solvedQuestionIds = new Set(["length-contraction"]);
    questionState = {
      kind: "ready",
      questions,
      source: "current",
      invalidCount: 0,
      cachedAt: null,
      refreshing: false,
      refreshError: false,
    };
    const Quiz = loadQuiz();
    const renderer = render(<Quiz />);

    expect(findAllByTestId(renderer, "answer-feedback-icon-correct")).toHaveLength(1);

    const liveRegions = renderer.root.findAll(
      (node) =>
        node.props.accessibilityLiveRegion === "polite" &&
        collectText(node.props.children).join("") === "Correct. Progress recorded.",
    );

    expect(liveRegions.length).toBeGreaterThanOrEqual(1);
  });

  it("preserves the active question and draft across a guest-to-account transition", async () => {
    questionState = {
      kind: "ready",
      questions,
      source: "current",
      invalidCount: 0,
      cachedAt: null,
      refreshing: false,
      refreshError: false,
    };
    const Quiz = loadQuiz();
    const renderer = render(<Quiz />);

    await act(async () => {
      await flush();
    });

    act(() => {
      findByAccessibilityLabel(renderer, "Next").props.onPress();
    });
    act(() => {
      renderer.root.findByType(TextInput).props.onChangeText("35.5");
    });

    expect(textContent(renderer)).toEqual(
      expect.arrayContaining(["Question 2 of 2", "How many minutes pass?"]),
    );
    expect(textContent(renderer)).toContain("0 of 2 solved");

    // The auth observer swaps guest storage for the signed-in account while
    // the quiz stays mounted; the in-progress draft must survive it.
    progressSource = "firebase";
    solvedQuestionIds = new Set(["length-contraction"]);
    syncStatus = "pending";

    await act(async () => {
      renderer.update(<Quiz />);
      await flush();
    });

    expect(textContent(renderer)).toEqual(
      expect.arrayContaining(["Question 2 of 2", "How many minutes pass?"]),
    );
    expect(renderer.root.findByType(TextInput).props.value).toBe("35.5");
    expect(textContent(renderer)).toContain("1 of 2 solved");
    expect(textContent(renderer)).toContain("Progress will sync when online.");
    expect(recordSolved).not.toHaveBeenCalled();
  });

  it("keeps pending sync status separate from correct-answer feedback", async () => {
    syncStatus = "pending";
    questionState = {
      kind: "ready",
      questions,
      source: "current",
      invalidCount: 0,
      cachedAt: null,
      refreshing: false,
      refreshError: false,
    };
    const Quiz = loadQuiz();
    const renderer = render(<Quiz />);
    const input = renderer.root.findByType(TextInput);

    act(() => {
      input.props.onChangeText("64");
    });
    await act(async () => {
      findByAccessibilityLabel(renderer, "Submit answer").props.onPress();
      await flush();
    });

    expect(textContent(renderer)).toEqual(
      expect.arrayContaining([
        "Progress will sync when online.",
        "Correct. Progress recorded.",
      ]),
    );
  });
});
