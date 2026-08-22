import React from "react";
import { Text, TextInput } from "react-native";
import { act, create, ReactTestInstance, ReactTestRenderer } from "react-test-renderer";

import { applyLabDrag, DEFAULT_LAB_ORIENTATION } from "@/domain/scene";

jest.setTimeout(20_000);

const replace = jest.fn();
const push = jest.fn();
const back = jest.fn();
const clearTextureCache = jest.fn();
const setAccessibilityFocus = jest.fn();
const sceneProps: Record<string, unknown>[] = [];
let reduceMotion = false;
let reduceMotionListener: ((enabled: boolean) => void) | null = null;
let canGoBack = true;
let panResponderConfig: Record<string, (...args: any[]) => unknown> | null = null;
let panResponderCreateCount = 0;

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const collectText = (node: unknown): string[] => {
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (typeof node === "object" && node !== null && "children" in node) {
    return collectText((node as { readonly children?: unknown }).children);
  }
  return [];
};

const textContent = (renderer: ReactTestRenderer): string[] =>
  renderer.root.findAllByType(Text).map((node) => collectText(node.props.children).join(""));

const findLabel = (renderer: ReactTestRenderer, label: string): ReactTestInstance =>
  renderer.root.find((node) => node.props.accessibilityLabel === label);

const renderComponent = (component: React.ReactElement): ReactTestRenderer =>
  create(component, { createNodeMock: () => ({}) });

const loadPlayground = () => {
  jest.resetModules();
  jest.doMock("react", () => React);
  jest.doMock("expo-router", () => ({
    useRouter: () => ({ back, canGoBack: () => canGoBack, push, replace }),
  }));
  jest.doMock("@/components/scene", () => ({
    CubeLabScene: (props: Record<string, unknown>) => {
      sceneProps.push(props);
      return React.createElement("CubeLabScene", props);
    },
  }));
  jest.doMock("@react-native-community/slider", () => "Slider");
  jest.doMock("@/components/scene/assets", () => ({
    sceneFallbackImage: 1,
    spaceCubeMapFaces: [1, 2, 3, 4, 5, 6],
  }));
  jest.doMock("@/components/scene/useLocalCubeTexture", () => ({
    clearLocalCubeTextureCache: clearTextureCache,
  }));
  jest.doMock("react-native", () => {
    const actual = jest.requireActual("react-native");
    const mock = Object.create(actual);
    Object.defineProperty(mock, "AccessibilityInfo", {
      value: {
        ...actual.AccessibilityInfo,
        addEventListener: jest.fn(
          (event: string, listener: (enabled: boolean) => void) => {
            if (event === "reduceMotionChanged") {
              reduceMotionListener = listener;
            }
            return { remove: jest.fn() };
          },
        ),
        announceForAccessibility: jest.fn(),
        isReduceMotionEnabled: jest.fn(async () => reduceMotion),
        setAccessibilityFocus,
      },
    });
    Object.defineProperty(mock, "findNodeHandle", {
      value: jest.fn(() => 42),
    });
    Object.defineProperty(mock, "PanResponder", {
      value: {
        create: jest.fn(
          (config: Record<string, (...args: any[]) => unknown>) => {
            panResponderConfig = config;
            panResponderCreateCount += 1;
            return { panHandlers: {} };
          },
        ),
      },
    });
    return mock;
  });
  return require("../app/(root)/playground").default as React.ComponentType;
};

describe("playground UI", () => {
  let renderer: ReactTestRenderer;

  beforeEach(() => {
    jest.clearAllMocks();
    sceneProps.length = 0;
    reduceMotion = false;
    reduceMotionListener = null;
    canGoBack = true;
    panResponderConfig = null;
    panResponderCreateCount = 0;
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    jest.useRealTimers();
  });

  it("starts automatic rotation unless reduce motion is enabled", async () => {
    const Playground = loadPlayground();
    await act(async () => {
      renderer = renderComponent(<Playground />);
      await flush();
    });
    expect(sceneProps.at(-1)?.autoRotate).toBe(true);
    act(() => reduceMotionListener?.(true));
    expect(sceneProps.at(-1)?.autoRotate).toBe(false);

    act(() => renderer.unmount());
    reduceMotion = true;
    sceneProps.length = 0;
    const ReducedPlayground = loadPlayground();
    await act(async () => {
      renderer = renderComponent(<ReducedPlayground />);
      await flush();
    });
    expect(sceneProps.at(-1)?.autoRotate).toBe(false);
  });

  it("synchronizes velocity input with scene geometry and preserves invalid drafts", async () => {
    const Playground = loadPlayground();
    await act(async () => {
      renderer = renderComponent(<Playground />);
      await flush();
    });

    act(() => findLabel(renderer, "Experiment Variables").props.onPress());
    const input = findLabel(renderer, "Velocity (fraction of c) X numeric value");
    act(() => input.props.onChangeText("0.6"));
    expect((sceneProps.at(-1)?.dimensions as { x: number }).x).toBeCloseTo(0.4, 8);

    act(() => input.props.onBlur());
    expect((sceneProps.at(-1)?.dimensions as { x: number }).x).toBeCloseTo(0.32, 8);

    act(() => input.props.onChangeText(""));
    expect((sceneProps.at(-1)?.dimensions as { x: number }).x).toBeCloseTo(0.32, 8);
    expect(renderer.root.findAllByType(TextInput).some((field) => field.props.value === "")).toBe(true);
  });

  it("exposes explicit resume, reset, home, quiz, and zoom controls", async () => {
    const Playground = loadPlayground();
    await act(async () => {
      renderer = renderComponent(<Playground />);
      await flush();
    });
    act(() => findLabel(renderer, "Lab Controls").props.onPress());

    expect(findLabel(renderer, "Pause rotation").props.accessibilityRole).toBe("switch");
    expect(findLabel(renderer, "Reset experiment")).toBeDefined();
    expect(findLabel(renderer, "Back to Home")).toBeDefined();
    expect(findLabel(renderer, "Open Quiz")).toBeDefined();
    expect(findLabel(renderer, "Zoom in")).toBeDefined();
    expect(findLabel(renderer, "Zoom out")).toBeDefined();
    expect(findLabel(renderer, "Back")).toBeDefined();
    expect(textContent(renderer)).toEqual(expect.arrayContaining(["X 1  •  Y 1  •  Z 1"]));
  });

  it("manual drag pauses rotation until the explicit resume action", async () => {
    const Playground = loadPlayground();
    await act(async () => {
      renderer = renderComponent(<Playground />);
      await flush();
    });

    act(() => (sceneProps.at(-1)?.onReady as () => void)());
    act(() => findLabel(renderer, "Zoom in").props.onPress());
    expect(sceneProps.at(-1)?.autoRotate).toBe(true);

    act(() => {
      panResponderConfig?.onPanResponderGrant();
    });
    expect(sceneProps.at(-1)?.autoRotate).toBe(false);

    act(() => findLabel(renderer, "Lab Controls").props.onPress());
    const resume = findLabel(renderer, "Resume rotation");
    act(() => resume.props.onPress());
    expect(sceneProps.at(-1)?.autoRotate).toBe(true);
  });

  it("accumulates a whole drag without rebuilding the gesture recogniser", async () => {
    const Playground = loadPlayground();
    await act(async () => {
      renderer = renderComponent(<Playground />);
      await flush();
    });
    act(() => (sceneProps.at(-1)?.onReady as () => void)());

    const createdBeforeDrag = panResponderCreateCount;
    act(() => {
      panResponderConfig?.onPanResponderGrant();
    });

    // PanResponder accumulates dx inside its own closure. If the recogniser is
    // rebuilt between moves that closure is replaced and the travelled
    // distance restarts, which leaves the cube almost stationary on device.
    for (const dx of [40, 90, 160]) {
      act(() => {
        panResponderConfig?.onPanResponderMove({}, { dx, dy: 0 });
      });
    }

    expect(panResponderCreateCount).toBe(createdBeforeDrag);

    const rotated = sceneProps.at(-1)?.orientation as { readonly y: number };
    const reference = applyLabDrag(DEFAULT_LAB_ORIENTATION, 160, 0);
    expect(rotated.y).toBeCloseTo(reference.y, 6);
    expect(Math.abs(rotated.y)).toBeGreaterThan(1);
  });

  it("retains navigation and clears failed texture cache before retry", async () => {
    const Playground = loadPlayground();
    await act(async () => {
      renderer = renderComponent(<Playground />);
      await flush();
    });

    const initialRetryKey = sceneProps.at(-1)?.retryKey;
    act(() =>
      (sceneProps.at(-1)?.onError as (failure: unknown) => void)({
        category: "asset",
        retryable: true,
      }),
    );
    expect(textContent(renderer)).toContain("The 3D laboratory is unavailable.");
    expect(findLabel(renderer, "Retry 3D laboratory")).toBeDefined();
    expect(findLabel(renderer, "Back to Home")).toBeDefined();
    act(() => findLabel(renderer, "Retry 3D laboratory").props.onPress());
    expect(clearTextureCache).toHaveBeenCalledWith([1, 2, 3, 4, 5, 6]);
    expect(sceneProps.at(-1)?.retryKey).toBe(Number(initialRetryKey) + 1);
    act(() => (sceneProps.at(-1)?.onReady as () => void)());
    expect(textContent(renderer)).not.toContain("The 3D laboratory is unavailable.");
  });

  it("uses navigation history for Back and safely falls back to Home", async () => {
    const Playground = loadPlayground();
    await act(async () => {
      renderer = renderComponent(<Playground />);
      await flush();
    });

    act(() => findLabel(renderer, "Back").props.onPress());
    expect(back).toHaveBeenCalledTimes(1);
    canGoBack = false;
    act(() => findLabel(renderer, "Back").props.onPress());
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("moves accessibility focus into an opened panel and back to its trigger", async () => {
    const Playground = loadPlayground();
    await act(async () => {
      renderer = renderComponent(<Playground />);
      await flush();
    });
    jest.useFakeTimers();

    act(() => findLabel(renderer, "Experiment Variables").props.onPress());
    act(() => jest.runOnlyPendingTimers());
    expect(setAccessibilityFocus).toHaveBeenCalledTimes(1);

    act(() => findLabel(renderer, "Experiment Variables").props.onPress());
    act(() => jest.runOnlyPendingTimers());
    expect(setAccessibilityFocus).toHaveBeenCalledTimes(2);
  });
});
