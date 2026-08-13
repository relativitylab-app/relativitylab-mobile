import {
  calculateLorentzFactorVector,
  calculateLorentzFactor,
  calculateRelativityDimensions,
  clampFiniteNumber,
  commitRelativityInputs,
  formatFractional,
  validateInitialDimensions,
  validateProperLength,
  validateRelativityInputs,
  validateRotationSpeed,
  validateScale,
  validateVelocity,
  validateVelocityVector,
} from "@/domain/relativity";

describe("relativity domain", () => {
  it("accepts finite proper lengths at and above the lower bound without a fixed maximum", () => {
    expect(validateProperLength(0.001)).toBe(0.001);
    expect(validateProperLength(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("rejects non-finite or too-small proper lengths", () => {
    expect(() => validateProperLength(0)).toThrow(RangeError);
    expect(() => validateProperLength(0.000999)).toThrow(RangeError);
    expect(() => validateProperLength(Infinity)).toThrow(RangeError);
    expect(() => validateProperLength(NaN)).toThrow(RangeError);
  });

  it("validates all three initial geometry dimensions", () => {
    expect(validateInitialDimensions({ x: 0.001, y: 2, z: 3 })).toEqual({
      x: 0.001,
      y: 2,
      z: 3,
    });
    expect(() => validateInitialDimensions({ x: 1, y: 0, z: 1 })).toThrow(
      RangeError,
    );
  });

  it("validates velocity, rotation speed, and scale inclusive ranges", () => {
    expect(validateVelocity(0)).toBe(0);
    expect(validateVelocity(0.999)).toBe(0.999);
    expect(validateVelocityVector({ x: 0, y: 0.5, z: 0.999 })).toEqual({
      x: 0,
      y: 0.5,
      z: 0.999,
    });
    expect(validateRotationSpeed(0.01)).toBe(0.01);
    expect(validateRotationSpeed(5)).toBe(5);
    expect(validateScale(0.05)).toBe(0.05);
    expect(validateScale(2)).toBe(2);
  });

  it("rejects values outside velocity, rotation, and scale bounds", () => {
    expect(() => validateVelocity(-0.001)).toThrow(RangeError);
    expect(() => validateVelocity(1)).toThrow(RangeError);
    expect(() => validateRotationSpeed(0.009)).toThrow(RangeError);
    expect(() => validateRotationSpeed(5.001)).toThrow(RangeError);
    expect(() => validateScale(0.049)).toThrow(RangeError);
    expect(() => validateScale(2.001)).toThrow(RangeError);
  });

  it("calculates Lorentz contraction and normalized dimensions", () => {
    expect(calculateLorentzFactor(0.6)).toBeCloseTo(1.25, 12);
    expect(calculateLorentzFactorVector({ x: 0.6, y: 0, z: 0.8 })).toEqual({
      x: 1.25,
      y: 1,
      z: expect.any(Number),
    });
    const dimensions = calculateRelativityDimensions({
      initialDimensions: { x: 80, y: 40, z: 20 },
      velocity: { x: 0.6, y: 0, z: 0.8 },
      rotationSpeed: 1,
      scale: 1.5,
    });

    expect(dimensions.initialDimensions).toEqual({ x: 80, y: 40, z: 20 });
    expect(dimensions.contractedDimensions.x).toBeCloseTo(64, 12);
    expect(dimensions.contractedDimensions.y).toBeCloseTo(40, 12);
    expect(dimensions.contractedDimensions.z).toBeCloseTo(12, 12);
    expect(dimensions.normalizedDimensions.x).toBeCloseTo(1.2, 12);
    expect(dimensions.normalizedDimensions.y).toBeCloseTo(0.75, 12);
    expect(dimensions.normalizedDimensions.z).toBeCloseTo(0.225, 12);
    expect(dimensions.gamma.x).toBeCloseTo(1.25, 12);
    expect(dimensions.gamma.y).toBeCloseTo(1, 12);
    expect(dimensions.gamma.z).toBeCloseTo(5 / 3, 12);
    expect(dimensions.maxInitialDimension).toBe(80);
    expect(dimensions.scale).toBe(1.5);
  });

  it("normalizes contracted dimensions against the current maximum initial dimension", () => {
    const dimensions = calculateRelativityDimensions({
      initialDimensions: { x: 10, y: 100, z: 50 },
      velocity: { x: 0.6, y: 0.6, z: 0 },
      rotationSpeed: 1,
      scale: 2,
    });

    expect(dimensions.maxInitialDimension).toBe(100);
    expect(dimensions.normalizedDimensions.x).toBeCloseTo(0.16, 12);
    expect(dimensions.normalizedDimensions.y).toBeCloseTo(1.6, 12);
    expect(dimensions.normalizedDimensions.z).toBeCloseTo(1, 12);
  });

  it("validates all relativity inputs together", () => {
    expect(
      validateRelativityInputs({
        initialDimensions: { x: 1, y: 2, z: 3 },
        velocity: { x: 0.1, y: 0.2, z: 0.3 },
        rotationSpeed: 0.5,
        scale: 1,
      }),
    ).toEqual({
      initialDimensions: { x: 1, y: 2, z: 3 },
      velocity: { x: 0.1, y: 0.2, z: 0.3 },
      rotationSpeed: 0.5,
      scale: 1,
    });
  });

  it("clamps finite draft values before committing valid relativity inputs", () => {
    expect(clampFiniteNumber(10, 0, 5, 1)).toBe(5);
    expect(clampFiniteNumber(-1, 0, 5, 1)).toBe(0);
    expect(clampFiniteNumber(Number.NaN, 0, 5, 1)).toBe(1);
    expect(() => clampFiniteNumber(Number.NaN, 0, 5, Number.NaN)).toThrow(
      RangeError,
    );

    expect(
      commitRelativityInputs({
        initialDimensions: { x: 0, y: Number.POSITIVE_INFINITY, z: 3 },
        velocity: { x: -1, y: 2, z: Number.NaN },
        rotationSpeed: 10,
        scale: 0,
      }),
    ).toEqual({
      initialDimensions: {
        x: 0.001,
        y: 0.001,
        z: 3,
      },
      velocity: { x: 0, y: 0.999, z: 0 },
      rotationSpeed: 5,
      scale: 0.05,
    });
  });

  it("formats with at most six fractional digits and never returns negative zero", () => {
    expect(formatFractional(1.23456789)).toBe("1.234568");
    expect(formatFractional(1.2)).toBe("1.2");
    expect(formatFractional(1)).toBe("1");
    expect(formatFractional(-0.0000001)).toBe("0");
    expect(formatFractional(-0)).toBe("0");
  });
});
