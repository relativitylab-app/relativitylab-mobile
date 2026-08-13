import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  AppStateStatus,
} from "react-native";

export interface SceneLifecycleState {
  readonly active: boolean;
  readonly reduceMotion: boolean;
}

export type SceneFrameLoop = "always" | "demand" | "never";

export const selectSceneFrameLoop = (
  active: boolean,
  animated: boolean,
): SceneFrameLoop => {
  if (!active) {
    return "never";
  }

  return animated ? "always" : "demand";
};

const isAppStateActive = (state: AppStateStatus): boolean => state === "active";

export const useSceneLifecycle = (): SceneLifecycleState => {
  const [active, setActive] = useState(isAppStateActive(AppState.currentState));
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let mounted = true;

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) {
          setReduceMotion(enabled);
        }
      })
      .catch(() => {
        if (mounted) {
          setReduceMotion(false);
        }
      });

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (mounted) {
        setActive(isAppStateActive(state));
      }
    });
    const motionSubscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        if (mounted) {
          setReduceMotion(enabled);
        }
      },
    );

    return () => {
      mounted = false;
      appStateSubscription.remove();
      motionSubscription.remove();
    };
  }, []);

  return { active, reduceMotion };
};
