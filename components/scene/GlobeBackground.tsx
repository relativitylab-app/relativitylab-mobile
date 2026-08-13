/* eslint-disable react/no-unknown-property */
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber/native";
import { StyleSheet, View } from "react-native";
import { MeshBasicMaterial } from "three";

import { globeCubeMapFaces } from "@/components/scene/assets";
import { SceneErrorBoundary } from "@/components/scene/SceneErrorBoundary";
import { useFirstSuccessfulSceneFrame } from "@/components/scene/renderReadiness";
import {
  selectSceneFrameLoop,
  useSceneLifecycle,
} from "@/components/scene/lifecycle";
import { useLocalCubeTexture } from "@/components/scene/useLocalCubeTexture";
import { classifySceneError, SceneFailure } from "@/domain/scene";

interface GlobeBackgroundProps {
  readonly onError: (failure: SceneFailure) => void;
}

interface GlobeContentProps {
  readonly active: boolean;
  readonly animated: boolean;
  readonly onReady: () => void;
}

const MAX_FRAME_DELTA_SECONDS = 0.05;

const GlobeContent = ({ active, animated, onReady }: GlobeContentProps) => {
  const globeRef = useRef<{
    rotation: { y: number };
    scale: { setScalar: (scale: number) => void };
  } | null>(null);
  const elapsedRef = useRef(0);
  const globeTexture = useLocalCubeTexture(globeCubeMapFaces);
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        envMap: globeTexture,
        reflectivity: 1,
      }),
    [globeTexture],
  );

  useEffect(() => {
    return () => material.dispose();
  }, [material]);
  useFirstSuccessfulSceneFrame(onReady);

  useFrame((_state, delta) => {
    if (!active || !animated || globeRef.current === null) {
      return;
    }

    const safeDelta = Math.min(delta, MAX_FRAME_DELTA_SECONDS);
    elapsedRef.current += safeDelta;
    globeRef.current.rotation.y += safeDelta * 0.12;
    globeRef.current.scale.setScalar(
      0.45 + Math.sin(elapsedRef.current * 0.65) * 0.25,
    );
  });

  return (
    <>
      <mesh ref={globeRef} scale={animated ? 0.45 : 0.58}>
        <sphereGeometry args={[2.8, 64, 48]} />
        <primitive attach="material" object={material} />
      </mesh>
    </>
  );
};

export const GlobeBackground = ({ onError }: GlobeBackgroundProps) => {
  const { active, reduceMotion } = useSceneLifecycle();
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const animated = !reduceMotion;
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!active || ready || failed) {
      return;
    }

    const timeout = setTimeout(() => {
      setFailed(true);
      onErrorRef.current({ category: "asset", retryable: true });
    }, 12_000);

    return () => {
      clearTimeout(timeout);
    };
  }, [active, failed, ready]);

  const handleError = useCallback((error: Error) => {
    setFailed(true);
    onErrorRef.current(classifySceneError(error));
  }, []);
  const handleReady = useCallback(() => setReady(true), []);

  return (
    <View
      accessibilityLabel="Animated globe in deep space"
      accessibilityRole="image"
      accessible
      pointerEvents="none"
      style={styles.fill}
    >
      {!failed ? (
        <SceneErrorBoundary onError={handleError} resetKey={0}>
          <Canvas
            camera={{ far: 100, fov: 42, near: 0.1, position: [0, 0, 8] }}
            frameloop={selectSceneFrameLoop(active, animated)}
            gl={{ alpha: true, antialias: true }}
            style={styles.fill}
          >
            <color args={["#02030a"]} attach="background" />
            <Suspense fallback={null}>
              <GlobeContent
                active={active}
                animated={animated}
                onReady={handleReady}
              />
            </Suspense>
          </Canvas>
        </SceneErrorBoundary>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
});
