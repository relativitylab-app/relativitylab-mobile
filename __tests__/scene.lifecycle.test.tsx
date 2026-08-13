import React from "react";
import { AccessibilityInfo, AppState } from "react-native";
import { act, create } from "react-test-renderer";

import {
  selectSceneFrameLoop,
  useSceneLifecycle,
} from "@/components/scene/lifecycle";

const LifecycleProbe = () => {
  const lifecycle = useSceneLifecycle();
  lifecycleSnapshots.push(lifecycle);
  return null;
};

const lifecycleSnapshots: {
  readonly active: boolean;
  readonly reduceMotion: boolean;
}[] = [];

describe("scene lifecycle", () => {
  afterEach(() => {
    lifecycleSnapshots.length = 0;
    jest.restoreAllMocks();
  });

  it("pauses frame work while inactive and uses demand rendering when stable", () => {
    expect(selectSceneFrameLoop(false, true)).toBe("never");
    expect(selectSceneFrameLoop(true, false)).toBe("demand");
    expect(selectSceneFrameLoop(true, true)).toBe("always");
  });

  it("removes both scene lifecycle listeners exactly once on unmount", async () => {
    const removeAppState = jest.fn();
    const removeReduceMotion = jest.fn();
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    jest.spyOn(AppState, "addEventListener").mockReturnValue({
      remove: removeAppState,
    } as unknown as ReturnType<typeof AppState.addEventListener>);
    jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({
      remove: removeReduceMotion,
    } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>);

    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<LifecycleProbe />);
      await Promise.resolve();
    });

    expect(AppState.addEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
    expect(AccessibilityInfo.addEventListener).toHaveBeenCalledWith(
      "reduceMotionChanged",
      expect.any(Function),
    );

    act(() => renderer!.unmount());
    expect(removeAppState).toHaveBeenCalledTimes(1);
    expect(removeReduceMotion).toHaveBeenCalledTimes(1);
  });

  it("pauses on background and restores exactly once on foreground", async () => {
    let appStateListener: ((state: "active" | "background") => void) | null = null;
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    jest.spyOn(AppState, "addEventListener").mockImplementation(
      (_event, listener) => {
        appStateListener = listener as (state: "active" | "background") => void;
        return { remove: jest.fn() } as unknown as ReturnType<
          typeof AppState.addEventListener
        >;
      },
    );
    jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({
      remove: jest.fn(),
    } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>);

    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<LifecycleProbe />);
      await Promise.resolve();
    });

    act(() => appStateListener?.("active"));
    expect(lifecycleSnapshots.at(-1)?.active).toBe(true);

    act(() => appStateListener?.("background"));
    expect(lifecycleSnapshots.at(-1)?.active).toBe(false);
    act(() => appStateListener?.("active"));
    expect(lifecycleSnapshots.at(-1)?.active).toBe(true);
    expect(
      (AppState.addEventListener as jest.Mock).mock.calls.filter(
        ([event, listener]) => event === "change" && listener === appStateListener,
      ),
    ).toHaveLength(1);

    act(() => renderer!.unmount());
  });
});
