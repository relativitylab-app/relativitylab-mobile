import { ImageSourcePropType } from "react-native";

export const CUBEMAP_FACE_ORDER = ["px", "nx", "py", "ny", "pz", "nz"] as const;
export const CUBEMAP_FACE_SOURCES = Object.freeze({
  px: "back",
  nx: "front",
  py: "top",
  ny: "bottom",
  pz: "right",
  nz: "left",
});

export const globeCubeMapFaces = [
  require("../../assets/scene/globe/px.png"),
  require("../../assets/scene/globe/nx.png"),
  require("../../assets/scene/globe/py.png"),
  require("../../assets/scene/globe/ny.png"),
  require("../../assets/scene/globe/pz.png"),
  require("../../assets/scene/globe/nz.png"),
] as const;

export const spaceCubeMapFaces = [
  require("../../assets/scene/space/px.png"),
  require("../../assets/scene/space/nx.png"),
  require("../../assets/scene/space/py.png"),
  require("../../assets/scene/space/ny.png"),
  require("../../assets/scene/space/pz.png"),
  require("../../assets/scene/space/nz.png"),
] as const;

export const sceneFallbackImage =
  require("../../assets/scene/space/nx.png") as ImageSourcePropType;

export const SCENE_ASSET_PROFILE = Object.freeze({
  faceWidth: 512,
  faceHeight: 512,
  facesPerCubeMap: 6,
  estimatedRgbaBytesPerCubeMap: 512 * 512 * 4 * 6,
});
