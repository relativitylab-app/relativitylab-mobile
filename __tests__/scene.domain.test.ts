import {
  applyCameraZoom,
  applyLabDrag,
  commitLabNumericDraft,
  classifySceneError,
  createLabState,
  DEFAULT_LAB_INPUTS,
  MAX_CAMERA_DISTANCE,
  MAX_VERTICAL_ROTATION,
  MIN_CAMERA_DISTANCE,
  parseFiniteDraft,
  readLiveLabValue,
  updateLabAxis,
} from "@/domain/scene";

describe("scene domain", () => {
  it("represents all simultaneous contractions in normalized geometry", () => {
    let inputs = updateLabAxis(DEFAULT_LAB_INPUTS, "x", "initialLength", 2);
    inputs = updateLabAxis(inputs, "x", "velocity", 0.6);
    inputs = updateLabAxis(inputs, "y", "velocity", 0.8);
    inputs = updateLabAxis(inputs, "z", "velocity", 0.999);

    const lab = createLabState(inputs, true);

    expect(lab.axes.x.finalLength).toBeCloseTo(1.6, 12);
    expect(lab.axes.y.finalLength).toBeCloseTo(0.6, 12);
    expect(lab.axes.z.finalLength).toBeCloseTo(
      Math.sqrt(1 - 0.999 ** 2),
      12,
    );
    expect(lab.dimensions.normalizedDimensions.x).toBeCloseTo(0.32, 12);
    expect(lab.dimensions.normalizedDimensions.y).toBeCloseTo(0.12, 12);
    expect(Number.isFinite(lab.dimensions.normalizedDimensions.z)).toBe(true);
    expect(lab.autoRotate).toBe(true);
  });

  it("keeps blank and invalid intermediate text from changing geometry", () => {
    expect(parseFiniteDraft("")).toBeNull();
    expect(parseFiniteDraft(" ")).toBeNull();
    expect(parseFiniteDraft("not-a-number")).toBeNull();
    expect(parseFiniteDraft("Infinity")).toBeNull();
    expect(readLiveLabValue("", "velocity")).toBeNull();
    expect(readLiveLabValue("1", "velocity")).toBeNull();
    expect(readLiveLabValue("0.6", "velocity")).toBe(0.6);
  });

  it("clamps finite committed values and rejects invalid commits", () => {
    expect(commitLabNumericDraft("-2", "velocity")).toEqual({
      value: 0,
      text: "0",
      issue: "clamped",
    });
    expect(commitLabNumericDraft("2", "velocity")).toEqual({
      value: 0.999,
      text: "0.999",
      issue: "clamped",
    });
    expect(commitLabNumericDraft("0.001", "initialLength")).toEqual({
      value: 0.001,
      text: "0.001",
      issue: null,
    });
    expect(commitLabNumericDraft("NaN", "scale")).toEqual({
      value: null,
      text: "NaN",
      issue: "invalid",
    });
  });

  it("clamps manual rotation and accessible zoom bounds", () => {
    const orientation = applyLabDrag({ x: 0, y: 0 }, 100, 10_000);
    expect(orientation.x).toBe(MAX_VERTICAL_ROTATION);
    expect(orientation.y).toBeCloseTo(0.8, 12);
    expect(applyCameraZoom(4, -100)).toBe(MIN_CAMERA_DISTANCE);
    expect(applyCameraZoom(4, 100)).toBe(MAX_CAMERA_DISTANCE);
  });

  it("maps asset, shader, context, and generic render failures to typed categories", () => {
    expect(classifySceneError(new Error("texture image failed")).category).toBe(
      "asset",
    );
    expect(classifySceneError(new Error("shader compile failed")).category).toBe(
      "shader",
    );
    expect(classifySceneError(new Error("GLView context failed")).category).toBe(
      "context",
    );
    expect(classifySceneError(new Error("unknown failure"))).toEqual({
      category: "render",
      retryable: true,
    });
  });
});
