import { useEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber/native";
import {
  CubeReflectionMapping,
  CubeTexture,
  SRGBColorSpace,
  TextureLoader,
} from "three";

export const createNativeCubeTexture = (faceTextures: readonly unknown[]) => {
  const texture = new CubeTexture([...faceTextures]);
  texture.mapping = CubeReflectionMapping;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

export const clearLocalCubeTextureCache = (faceModules: readonly number[]) => {
  useLoader.clear(TextureLoader, faceModules as unknown as string[]);
};

export const useLocalCubeTexture = (faceModules: readonly number[]) => {
  const faceTextures = useLoader(
    TextureLoader,
    faceModules as unknown as string[],
  );
  const cubeTexture = useMemo(
    () => createNativeCubeTexture(faceTextures),
    [faceTextures],
  );

  useEffect(
    () => () => {
      cubeTexture.dispose();
    },
    [cubeTexture],
  );

  return cubeTexture;
};
