/* eslint-disable react/no-unknown-property */
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import { StyleSheet, View } from "react-native";
import { MeshPhysicalMaterial } from "three";

import { spaceCubeMapFaces } from "@/components/scene/assets";
import { SceneErrorBoundary } from "@/components/scene/SceneErrorBoundary";
import { useFirstSuccessfulSceneFrame } from "@/components/scene/renderReadiness";
import {
  selectSceneFrameLoop,
  useSceneLifecycle,
} from "@/components/scene/lifecycle";
import { useLocalCubeTexture } from "@/components/scene/useLocalCubeTexture";
import {
  classifySceneError,
  LabOrientation,
  SceneFailure,
} from "@/domain/scene";
import { RelativityVector3 } from "@/domain/relativity";

interface CubeLabSceneProps {
  readonly autoRotate: boolean;
  readonly cameraDistance: number;
  readonly dimensions: RelativityVector3;
  readonly onError: (failure: SceneFailure) => void;
  readonly onReady: () => void;
  readonly orientation: LabOrientation;
  readonly retryKey: number;
  readonly rotationSpeed: number;
}

interface CubeContentProps
  extends Omit<CubeLabSceneProps, "onError" | "retryKey"> {
  readonly active: boolean;
  readonly motionEnabled: boolean;
}

const MAX_FRAME_DELTA_SECONDS = 0.05;

const CubeContent = ({
  active,
  autoRotate,
  cameraDistance,
  dimensions,
  motionEnabled,
  onReady,
  orientation,
  rotationSpeed,
}: CubeContentProps) => {
  const autoRotationRef = useRef<{ rotation: { y: number } } | null>(null);
  const cubeTexture = useLocalCubeTexture(spaceCubeMapFaces);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        clearcoat: 0.7,
        envMap: cubeTexture,
        metalness: 0.82,
        roughness: 0.12,
      }),
    [cubeTexture],
  );

  useEffect(() => {
    scene.background = cubeTexture;
    scene.environment = cubeTexture;

    return () => {
      if (scene.background === cubeTexture) {
        scene.background = null;
      }
      if (scene.environment === cubeTexture) {
        scene.environment = null;
      }
      material.dispose();
    };
  }, [cubeTexture, material, scene]);
  useFirstSuccessfulSceneFrame(onReady);

  useEffect(() => {
    camera.position.z = cameraDistance;
    camera.updateProjectionMatrix();
  }, [camera, cameraDistance]);

  useFrame((_state, delta) => {
    if (
      !active ||
      !motionEnabled ||
      !autoRotate ||
      autoRotationRef.current === null
    ) {
      return;
    }

    autoRotationRef.current.rotation.y +=
      Math.min(delta, MAX_FRAME_DELTA_SECONDS) * rotationSpeed;
  });

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight intensity={1.3} position={[4, 5, 6]} />
      <group rotation={[orientation.x, orientation.y, 0]}>
        <group ref={autoRotationRef}>
          <mesh>
            <boxGeometry
              args={[dimensions.x, dimensions.y, dimensions.z, 1, 1, 1]}
            />
            <primitive attach="material" object={material} />
          </mesh>
          <axesHelper args={[Math.max(dimensions.x, dimensions.y, dimensions.z) * 1.4]} />
        </group>
      </group>
    </>
  );
};

export const CubeLabScene = ({
  autoRotate,
  cameraDistance,
  dimensions,
  onError,
  onReady,
  orientation,
  retryKey,
  rotationSpeed,
}: CubeLabSceneProps) => {
  const { active, reduceMotion } = useSceneLifecycle();
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const motionEnabled = !reduceMotion;
  const animated = autoRotate && motionEnabled;
  const onErrorRef = useRef(onError);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onErrorRef.current = onError;
    onReadyRef.current = onReady;
  }, [onError, onReady]);

  useEffect(() => {
    setFailed(false);
    setReady(false);
  }, [retryKey]);

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
  }, [active, failed, ready, retryKey]);

  const handleError = useCallback((error: Error) => {
    setFailed(true);
    onErrorRef.current(classifySceneError(error));
  }, []);
  const handleReady = useCallback(() => {
    setReady(true);
    onReadyRef.current();
  }, []);

  return (
    <View
      accessibilityLabel="Three-dimensional relativity cube with red X, green Y, and blue Z axes"
      accessibilityRole="image"
      accessible
      pointerEvents="none"
      style={styles.fill}
    >
      {!failed ? (
        <SceneErrorBoundary onError={handleError} resetKey={retryKey}>
          <Canvas
            camera={{
              far: 100,
              fov: 44,
              near: 0.1,
              position: [0, 0, cameraDistance],
            }}
            frameloop={selectSceneFrameLoop(active, animated)}
            gl={{ alpha: false, antialias: true }}
            key={retryKey}
            style={styles.fill}
          >
            <Suspense fallback={null}>
              <CubeContent
                active={active}
                autoRotate={autoRotate}
                cameraDistance={cameraDistance}
                dimensions={dimensions}
                motionEnabled={motionEnabled}
                onReady={handleReady}
                orientation={orientation}
                rotationSpeed={rotationSpeed}
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
