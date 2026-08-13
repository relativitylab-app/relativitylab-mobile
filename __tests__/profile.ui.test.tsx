import React from "react";
import { Image, Text, TouchableOpacity } from "react-native";
import {
  act,
  create,
  ReactTestInstance,
  ReactTestRenderer,
} from "react-test-renderer";

const returnToSignIn = jest.fn(async () => undefined);
const signInWithApple = jest.fn(async () => undefined);
const signInWithGoogle = jest.fn(async () => undefined);
const signOut = jest.fn(async () => undefined);
const retry = jest.fn(async () => undefined);
const retrySync = jest.fn(async () => undefined);
const isAppleAvailableAsync = jest.fn<Promise<boolean>, []>(
  () => new Promise<boolean>(() => undefined),
);
const AppleProfileButtonMock = "AppleProfileButton" as unknown as React.ElementType;
const LinkMock = ({ children }: { readonly children: React.ReactNode }) => <>{children}</>;
interface AuthState {
  readonly action: string;
  readonly returnToSignIn: typeof returnToSignIn;
  readonly signInWithApple: typeof signInWithApple;
  readonly signInWithGoogle: typeof signInWithGoogle;
  readonly signOut: typeof signOut;
  readonly status: "authenticated" | "guest";
  readonly user: {
    readonly displayName: string | null;
    readonly email: string | null;
    readonly photoURL: string | null;
  } | null;
}

let authState: AuthState = {
  action: "none",
  returnToSignIn,
  signInWithApple,
  signInWithGoogle,
  signOut,
  status: "authenticated",
  user: {
    displayName: "Ada",
    email: "ada@example.com",
    photoURL: null,
  },
};
let questionState = {
  kind: "ready",
  questions: [
    { id: "q2", number: 2, question: "Second", answer: 2 },
    { id: "q1", number: 1, question: "First", answer: 1 },
  ],
};
let progressState = {
  isLoading: false,
  retrySync,
  solvedQuestionIds: new Set(["q1", "unknown"]),
  syncStatus: "pending",
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

const loadProfile = () => {
  jest.resetModules();
  jest.doMock("react", () => React);
  jest.doMock("expo-router", () => ({ Link: LinkMock }));
  jest.doMock("expo-apple-authentication", () => ({
    AppleAuthenticationButton: (props: Record<string, unknown>) =>
      React.createElement(AppleProfileButtonMock, props),
    AppleAuthenticationButtonStyle: { BLACK: "BLACK" },
    AppleAuthenticationButtonType: { CONTINUE: "CONTINUE" },
    isAvailableAsync: isAppleAvailableAsync,
  }));
  jest.doMock("@/providers/AuthProvider", () => ({
    useAuth: () => authState,
  }));
  jest.doMock("@/providers/QuestionProvider", () => ({
    useQuestions: () => ({ state: questionState, retry }),
  }));
  jest.doMock("@/providers/ProgressProvider", () => ({
    useProgress: () => progressState,
  }));

  return require("../app/(root)/(tabs)/profile").default as React.ComponentType;
};

describe("profile UI", () => {
  const renderers: ReactTestRenderer[] = [];

  const render = (component: React.ReactElement): ReactTestRenderer => {
    const renderer = create(component);
    renderers.push(renderer);
    return renderer;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    isAppleAvailableAsync.mockImplementation(
      () => new Promise<boolean>(() => undefined),
    );
    authState = {
      action: "none",
      returnToSignIn,
      signInWithApple,
      signInWithGoogle,
      signOut,
      status: "authenticated",
      user: {
        displayName: "Ada",
        email: "ada@example.com",
        photoURL: null,
      },
    };
    questionState = {
      kind: "ready",
      questions: [
        { id: "q2", number: 2, question: "Second", answer: 2 },
        { id: "q1", number: 1, question: "First", answer: 1 },
      ],
    };
    progressState = {
      isLoading: false,
      retrySync,
      solvedQuestionIds: new Set(["q1", "unknown"]),
      syncStatus: "pending",
    };
  });

  afterEach(() => {
    act(() => {
      renderers.splice(0).forEach((renderer) => renderer.unmount());
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("preserves guest identity and explains on-device progress merge", () => {
    authState = {
      ...authState,
      status: "guest",
      user: null,
    };
    const Profile = loadProfile();
    const renderer = render(<Profile />);

    expect(textContent(renderer)).toEqual(
      expect.arrayContaining([
        "Guest profile",
        "Guest progress is stored on this device. Sign in to preserve and merge progress across devices.",
        "Solved: 1",
        "Question 1",
      ]),
    );

    act(() => {
      findByAccessibilityLabel(renderer, "Continue with Google").props.onPress();
    });
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it("offers native Apple sign-in to guests when it is available", async () => {
    isAppleAvailableAsync.mockResolvedValueOnce(true);
    authState = {
      ...authState,
      status: "guest",
      user: null,
    };
    const Profile = loadProfile();
    let renderer!: ReactTestRenderer;

    await act(async () => {
      renderer = render(<Profile />);
      await Promise.resolve();
    });

    act(() => {
      findByAccessibilityLabel(renderer, "Continue with Apple").props.onPress();
    });
    expect(signInWithApple).toHaveBeenCalledTimes(1);
  });

  it("renders ordered solved links, unknown-safe rows, count, and pending sync copy", () => {
    const Profile = loadProfile();
    const renderer = render(<Profile />);
    const text = textContent(renderer);

    expect(text).toEqual(
      expect.arrayContaining([
        "Ada",
        "Solved questions",
        "Solved: 1",
        "Question 1",
        "Unknown question",
        "Progress will sync when online.",
      ]),
    );

    const links = renderer.root
      .findAllByType(TouchableOpacity)
      .filter((node) => node.props.accessibilityRole === "link");
    expect(links.map((link) => link.props.accessibilityLabel)).toEqual([
      "Question 1",
    ]);
  });

  it("replaces a failed remote profile photo with the local initial fallback", () => {
    authState = {
      ...authState,
      user: {
        displayName: "Ada",
        email: "ada@example.com",
        photoURL: "https://example.test/ada.jpg",
      },
    };
    const Profile = loadProfile();
    const renderer = render(<Profile />);
    const photo = renderer.root
      .findAllByType(Image)
      .find((image) => image.props.accessibilityLabel === "Ada profile photo");

    expect(photo).toBeDefined();
    act(() => {
      photo?.props.onError();
    });

    expect(findByAccessibilityLabel(renderer, "Ada profile placeholder")).toBeDefined();
  });
});
