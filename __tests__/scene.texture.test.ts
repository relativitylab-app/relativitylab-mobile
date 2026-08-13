const mockClear = jest.fn();

jest.mock("@react-three/fiber/native", () => ({
  useLoader: Object.assign(jest.fn(), { clear: mockClear }),
}));

describe("native cube texture assembly", () => {
  it("preserves each native Texture wrapper and clears exact retry cache keys", () => {
    const {
      clearLocalCubeTextureCache,
      createNativeCubeTexture,
    } = require("@/components/scene/useLocalCubeTexture");
    const nativeFaces = Array.from({ length: 6 }, (_, index) => ({
      image: {
        data: { localUri: `file:///face-${index}.png` },
        height: 512,
        width: 512,
      },
      isDataTexture: true,
    }));

    const cubeTexture = createNativeCubeTexture(nativeFaces);
    expect(cubeTexture.images).toEqual(nativeFaces);
    expect(cubeTexture.images[0].isDataTexture).toBe(true);
    expect(cubeTexture.images[0].image.data.localUri).toBe(
      "file:///face-0.png",
    );

    clearLocalCubeTextureCache([1, 2, 3, 4, 5, 6]);
    expect(mockClear).toHaveBeenCalledWith(
      expect.anything(),
      [1, 2, 3, 4, 5, 6],
    );
  });
});
