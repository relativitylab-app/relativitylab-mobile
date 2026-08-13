import {
  CUBEMAP_FACE_ORDER,
  CUBEMAP_FACE_SOURCES,
  globeCubeMapFaces,
  SCENE_ASSET_PROFILE,
  spaceCubeMapFaces,
} from "@/components/scene/assets";

describe("bundled scene assets", () => {
  it("keeps the WebGL cube-map orientation and bounded mobile texture size", () => {
    expect(CUBEMAP_FACE_ORDER).toEqual(["px", "nx", "py", "ny", "pz", "nz"]);
    expect(CUBEMAP_FACE_SOURCES).toEqual({
      px: "back",
      nx: "front",
      py: "top",
      ny: "bottom",
      pz: "right",
      nz: "left",
    });
    expect(globeCubeMapFaces).toHaveLength(6);
    expect(spaceCubeMapFaces).toHaveLength(6);
    expect(SCENE_ASSET_PROFILE.faceWidth).toBe(512);
    expect(SCENE_ASSET_PROFILE.estimatedRgbaBytesPerCubeMap).toBe(6_291_456);
  });
});
