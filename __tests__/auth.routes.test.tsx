import React from "react";
import { Pressable } from "react-native";
import { act, create, ReactTestRenderer } from "react-test-renderer";

type AuthStatus = "initializing" | "signedOut" | "guest" | "authenticated";
type AuthAction = "none" | "google" | "apple" | "guest" | "signOut";
type AuthErrorCategory =
  | "cancelled"
  | "network"
  | "credential"
  | "config"
  | "unavailable"
  | "accountConflict"
  | "unknown";

interface AuthRouteState {
  readonly status: AuthStatus;
  readonly user: null;
  readonly hasChosenGuest: boolean;
  readonly initializingAuth: boolean;
  readonly initializingGuestChoice: boolean;
  readonly action: AuthAction;
  readonly error: { readonly category: AuthErrorCategory; readonly retryable: boolean } | null;
}

const baseAuthState: AuthRouteState = {
  status: "signedOut",
  user: null,
  hasChosenGuest: false,
  initializingAuth: false,
  initializingGuestChoice: false,
  action: "none",
  error: null,
};

const signInWithGoogle = jest.fn(async () => undefined);
const signInWithApple = jest.fn(async () => undefined);
const continueAsGuest = jest.fn(async () => undefined);
const returnToSignIn = jest.fn(async () => undefined);
const signOut = jest.fn(async () => undefined);
const clearError = jest.fn();
const useFonts = jest.fn(() => [true]);
const preventAutoHideAsync = jest.fn(async () => undefined);
const hideAsync = jest.fn(async () => undefined);
const isAppleAvailableAsync = jest.fn(async () => false);

let authState: AuthRouteState = baseAuthState;
let platformOS: "ios" | "android" = "android";
const RedirectMock = "Redirect" as unknown as React.ElementType;
const SlotMock = "Slot" as unknown as React.ElementType;
const StackMock = "Stack" as unknown as React.ElementType;
const AppleAuthenticationButtonMock =
  "AppleAuthenticationButton" as unknown as React.ElementType;

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const mockRouteModules = () => {
  jest.doMock("react", () => React);
  jest.doMock("@/providers/AuthProvider", () => ({
    AuthProvider: ({ children }: { readonly children: React.ReactNode }) => <>{children}</>,
    useAuth: () => ({
      ...authState,
      signInWithGoogle,
      signInWithApple,
      continueAsGuest,
      returnToSignIn,
      signOut,
      clearError,
    }),
  }));
  jest.doMock("@/providers/ProgressProvider", () => ({
    ProgressProvider: ({ children }: { readonly children: React.ReactNode }) => (
      <>{children}</>
    ),
  }));
  jest.doMock("@/providers/QuestionProvider", () => ({
    QuestionProvider: ({ children }: { readonly children: React.ReactNode }) => (
      <>{children}</>
    ),
  }));
  jest.doMock("expo-router", () => ({
    Redirect: (props: { readonly href: string }) =>
      React.createElement(RedirectMock, props),
    Slot: () => React.createElement(SlotMock),
    Stack: (props: { readonly screenOptions?: Record<string, unknown> }) =>
      React.createElement(StackMock, props),
  }));
  jest.doMock("expo-font", () => ({
    useFonts,
  }));
  jest.doMock("expo-splash-screen", () => ({
    preventAutoHideAsync,
    hideAsync,
  }));
  jest.doMock("expo-apple-authentication", () => ({
    AppleAuthenticationButton: (props: {
      readonly onPress?: () => void;
      readonly style?: Record<string, unknown>;
    }) => React.createElement(AppleAuthenticationButtonMock, props),
    AppleAuthenticationButtonStyle: {
      WHITE: "WHITE",
    },
    AppleAuthenticationButtonType: {
      CONTINUE: "CONTINUE",
    },
    isAvailableAsync: isAppleAvailableAsync,
  }));
  jest.doMock("@/components/scene", () => ({
    GlobeBackground: ({ onError }: { readonly onError: () => void }) =>
      React.createElement("GlobeBackground", { onError }),
  }));
  jest.doMock("@/components/scene/assets", () => ({
    sceneFallbackImage: { uri: "scene-fallback" },
  }));
  jest.doMock("react-native", () => {
    const actual = jest.requireActual("react-native");
    const mock = Object.create(actual);

    Object.defineProperty(mock, "Platform", {
      value: {
        ...actual.Platform,
        OS: platformOS,
        select: (config: Record<string, unknown>) =>
          config[platformOS] ?? config.default,
      },
    });

    return mock;
  });
  jest.doMock("../app/global.css", () => ({}));
};

const loadSignInRoute = async () => {
  jest.resetModules();
  mockRouteModules();
  const route = require("../app/sign-in");
  await flush();

  return route.default as React.ComponentType;
};

const loadRootGroupLayout = async () => {
  jest.resetModules();
  mockRouteModules();
  const route = require("../app/(root)/_layout");
  await flush();

  return route.default as React.ComponentType;
};

const loadRootLayout = async () => {
  jest.resetModules();
  mockRouteModules();
  const route = require("../app/_layout");
  await flush();

  return route.default as React.ComponentType;
};

const collectText = (node: unknown): string[] => {
  if (typeof node === "string") {
    return [node];
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
  collectText(renderer.toJSON());

const textFromChildren = (children: unknown): string =>
  collectText(children).join("");

describe("auth routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authState = baseAuthState;
    platformOS = "android";
    useFonts.mockReturnValue([true]);
    isAppleAvailableAsync.mockResolvedValue(false);
  });

  it("redirects sign-in guests to the app root", async () => {
    authState = { ...baseAuthState, status: "guest", hasChosenGuest: true };
    const SignIn = await loadSignInRoute();
    const renderer = create(<SignIn />);

    expect(renderer.root.findByType(RedirectMock).props.href).toBe("/");
  });

  it("redirects authenticated users from sign-in to the app root", async () => {
    authState = { ...baseAuthState, status: "authenticated" };
    const SignIn = await loadSignInRoute();
    const renderer = create(<SignIn />);

    expect(renderer.root.findByType(RedirectMock).props.href).toBe("/");
  });

  it("renders accessible Google and guest sign-in buttons when signed out", async () => {
    const { authStrings } = require("@/constants/strings");
    const SignIn = await loadSignInRoute();
    const renderer = create(<SignIn />);
    const buttons = renderer.root.findAllByType(Pressable);

    expect(buttons).toHaveLength(2);
    expect(buttons[0].props.accessibilityRole).toBe("button");
    expect(buttons[0].props.accessibilityHint).toBe(authStrings.hints.google);
    expect(buttons[1].props.accessibilityRole).toBe("button");
    expect(buttons[1].props.accessibilityHint).toBe(authStrings.hints.guest);
    expect(textContent(renderer)).toEqual(
      expect.arrayContaining([
        authStrings.actions.google,
        authStrings.actions.guest,
      ]),
    );
  });

  it("does not check or render Apple sign-in outside iOS", async () => {
    platformOS = "android";
    const SignIn = await loadSignInRoute();
    const renderer = create(<SignIn />);

    expect(isAppleAvailableAsync).not.toHaveBeenCalled();
    expect(renderer.root.findAllByType(AppleAuthenticationButtonMock)).toHaveLength(0);
  });

  it("does not render Apple sign-in on iOS when Apple authentication is unavailable", async () => {
    platformOS = "ios";
    isAppleAvailableAsync.mockResolvedValue(false);
    const SignIn = await loadSignInRoute();
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(<SignIn />);
      await flush();
    });

    expect(isAppleAvailableAsync).toHaveBeenCalledTimes(1);
    expect(renderer!.root.findAllByType(AppleAuthenticationButtonMock)).toHaveLength(0);
  });

  it("renders Apple sign-in on iOS when Apple authentication is available", async () => {
    platformOS = "ios";
    isAppleAvailableAsync.mockResolvedValue(true);
    const SignIn = await loadSignInRoute();
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(<SignIn />);
      await flush();
    });

    const appleButtons = renderer!.root.findAllByType(AppleAuthenticationButtonMock);
    expect(appleButtons).toHaveLength(1);

    appleButtons[0].props.onPress();
    expect(signInWithApple).toHaveBeenCalledTimes(1);
  });

  it("disables duplicate sign-in actions and announces active Google status", async () => {
    const { authStrings } = require("@/constants/strings");
    authState = { ...baseAuthState, action: "google" };
    const SignIn = await loadSignInRoute();
    const renderer = create(<SignIn />);
    const buttons = renderer.root.findAllByType(Pressable);

    expect(buttons[0].props.disabled).toBe(true);
    expect(buttons[0].props.accessibilityState).toEqual({
      busy: true,
      disabled: true,
    });
    expect(buttons[1].props.disabled).toBe(true);
    expect(buttons[1].props.accessibilityState).toEqual({
      busy: false,
      disabled: true,
    });
    expect(textContent(renderer)).toContain(authStrings.activeLabels.google);
  });

  it("renders centralized error copy in a live region", async () => {
    const { authStrings } = require("@/constants/strings");
    authState = {
      ...baseAuthState,
      error: { category: "network", retryable: true },
    };
    const SignIn = await loadSignInRoute();
    const renderer = create(<SignIn />);
    const errorText = renderer.root.findAll(
      (node) =>
        node.props.accessibilityLiveRegion === "polite" &&
        textFromChildren(node.props.children) === authStrings.messages.network,
    );

    expect(errorText.length).toBeGreaterThanOrEqual(1);
    errorText.forEach((node) => {
      expect(node.props.accessibilityLiveRegion).toBe("polite");
      expect(textFromChildren(node.props.children)).toBe(authStrings.messages.network);
    });
  });

  it("redirects signed-out users from the root group to sign-in", async () => {
    authState = { ...baseAuthState, status: "signedOut" };
    const RootGroupLayout = await loadRootGroupLayout();
    const renderer = create(<RootGroupLayout />);

    expect(renderer.root.findByType(RedirectMock).props.href).toBe("/sign-in");
  });

  it("renders root group slots for guest users", async () => {
    authState = { ...baseAuthState, status: "guest", hasChosenGuest: true };
    const RootGroupLayout = await loadRootGroupLayout();
    const renderer = create(<RootGroupLayout />);

    expect(renderer.root.findAllByType(SlotMock)).toHaveLength(1);
  });

  it("renders root group slots for authenticated users", async () => {
    authState = { ...baseAuthState, status: "authenticated" };
    const RootGroupLayout = await loadRootGroupLayout();
    const renderer = create(<RootGroupLayout />);

    expect(renderer.root.findAllByType(SlotMock)).toHaveLength(1);
  });

  it("prevents splash auto-hide at startup module scope", async () => {
    await loadRootLayout();

    expect(preventAutoHideAsync).toHaveBeenCalledTimes(1);
  });

  it("hides the startup splash only once after fonts and auth startup settle", async () => {
    authState = {
      ...baseAuthState,
      status: "initializing",
      initializingAuth: false,
      initializingGuestChoice: true,
    };
    useFonts.mockReturnValue([true]);
    const RootLayout = await loadRootLayout();
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(<RootLayout />);
      await flush();
    });

    expect(hideAsync).not.toHaveBeenCalled();
    expect(renderer!.root.findAllByType(StackMock)).toHaveLength(0);

    authState = {
      ...baseAuthState,
      status: "signedOut",
      initializingAuth: false,
      initializingGuestChoice: false,
    };

    await act(async () => {
      renderer!.update(<RootLayout />);
      await flush();
    });

    expect(hideAsync).toHaveBeenCalledTimes(1);
    expect(renderer!.root.findAllByType(StackMock)).toHaveLength(1);

    await act(async () => {
      renderer!.update(<RootLayout />);
      await flush();
    });

    expect(hideAsync).toHaveBeenCalledTimes(1);
  });
});
