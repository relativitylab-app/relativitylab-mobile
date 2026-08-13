import { useEffect, useRef } from "react";
import { addAfterEffect, useFrame } from "@react-three/fiber/native";

export interface SceneFrameReadiness {
  readonly afterRender: () => void;
  readonly beforeRender: () => void;
}

export const createSceneFrameReadiness = (
  onReady: () => void,
): SceneFrameReadiness => {
  let frameGeneration = 0;
  let renderedGeneration = 0;
  let ready = false;

  return {
    beforeRender: () => {
      frameGeneration += 1;
    },
    afterRender: () => {
      if (ready || frameGeneration === renderedGeneration) {
        return;
      }
      renderedGeneration = frameGeneration;
      ready = true;
      onReady();
    },
  };
};

export const useFirstSuccessfulSceneFrame = (onReady: () => void) => {
  const readinessRef = useRef<SceneFrameReadiness | null>(null);
  const onReadyRef = useRef(onReady);

  if (readinessRef.current === null) {
    readinessRef.current = createSceneFrameReadiness(() => onReadyRef.current());
  }

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useFrame(() => {
    readinessRef.current?.beforeRender();
  });

  useEffect(
    () => addAfterEffect(() => readinessRef.current?.afterRender()),
    [],
  );
};
