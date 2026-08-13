export interface RelativityInputs {
  readonly initialDimensions: RelativityVector3;
  readonly velocity: RelativityVector3;
  readonly rotationSpeed: number;
  readonly scale: number;
}

export interface RelativityVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface RelativityDimensions {
  readonly initialDimensions: RelativityVector3;
  readonly contractedDimensions: RelativityVector3;
  readonly normalizedDimensions: RelativityVector3;
  readonly gamma: RelativityVector3;
  readonly maxInitialDimension: number;
  readonly scale: number;
}

export const MIN_INITIAL_LENGTH = 0.001;
export const MIN_VELOCITY = 0;
export const MAX_VELOCITY = 0.999;
export const MIN_ROTATION_SPEED = 0.01;
export const MAX_ROTATION_SPEED = 5;
export const MIN_SCALE = 0.05;
export const MAX_SCALE = 2;

const assertFiniteNumber = (name: string, value: number): void => {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite`);
  }
};

const assertRange = (
  name: string,
  value: number,
  min: number,
  max: number,
): void => {
  assertFiniteNumber(name, value);

  if (value < min || value > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}`);
  }
};

export const validateProperLength = (properLength: number): number => {
  assertFiniteNumber("properLength", properLength);

  if (properLength < MIN_INITIAL_LENGTH) {
    throw new RangeError(`properLength must be at least ${MIN_INITIAL_LENGTH}`);
  }

  return properLength;
};

export const validateInitialDimensions = (
  initialDimensions: RelativityVector3,
): RelativityVector3 => ({
  x: validateProperLength(initialDimensions.x),
  y: validateProperLength(initialDimensions.y),
  z: validateProperLength(initialDimensions.z),
});

export const validateVelocity = (velocity: number): number => {
  assertRange("velocity", velocity, MIN_VELOCITY, MAX_VELOCITY);
  return velocity;
};

export const validateVelocityVector = (
  velocity: RelativityVector3,
): RelativityVector3 => ({
  x: validateVelocity(velocity.x),
  y: validateVelocity(velocity.y),
  z: validateVelocity(velocity.z),
});

export const validateRotationSpeed = (rotationSpeed: number): number => {
  assertRange(
    "rotationSpeed",
    rotationSpeed,
    MIN_ROTATION_SPEED,
    MAX_ROTATION_SPEED,
  );
  return rotationSpeed;
};

export const validateScale = (scale: number): number => {
  assertRange("scale", scale, MIN_SCALE, MAX_SCALE);
  return scale;
};

export const validateRelativityInputs = (
  inputs: RelativityInputs,
): RelativityInputs => ({
  initialDimensions: validateInitialDimensions(inputs.initialDimensions),
  velocity: validateVelocityVector(inputs.velocity),
  rotationSpeed: validateRotationSpeed(inputs.rotationSpeed),
  scale: validateScale(inputs.scale),
});

export const calculateLorentzFactor = (velocity: number): number => {
  const validVelocity = validateVelocity(velocity);
  return 1 / Math.sqrt(1 - validVelocity * validVelocity);
};

export const calculateLorentzFactorVector = (
  velocity: RelativityVector3,
): RelativityVector3 => ({
  x: calculateLorentzFactor(velocity.x),
  y: calculateLorentzFactor(velocity.y),
  z: calculateLorentzFactor(velocity.z),
});

export const calculateRelativityDimensions = (
  inputs: RelativityInputs,
): RelativityDimensions => {
  const validInputs = validateRelativityInputs(inputs);
  const gamma = calculateLorentzFactorVector(validInputs.velocity);
  const contractedDimensions = {
    x: validInputs.initialDimensions.x / gamma.x,
    y: validInputs.initialDimensions.y / gamma.y,
    z: validInputs.initialDimensions.z / gamma.z,
  };
  const maxInitialDimension = Math.max(
    validInputs.initialDimensions.x,
    validInputs.initialDimensions.y,
    validInputs.initialDimensions.z,
  );

  return {
    initialDimensions: validInputs.initialDimensions,
    contractedDimensions,
    normalizedDimensions: {
      x: (contractedDimensions.x / maxInitialDimension) * validInputs.scale,
      y: (contractedDimensions.y / maxInitialDimension) * validInputs.scale,
      z: (contractedDimensions.z / maxInitialDimension) * validInputs.scale,
    },
    gamma,
    maxInitialDimension,
    scale: validInputs.scale,
  };
};

export const clampFiniteNumber = (
  value: number,
  min: number,
  max: number,
  fallback: number,
): number => {
  const finiteValue = Number.isFinite(value) ? value : fallback;

  if (!Number.isFinite(finiteValue)) {
    throw new RangeError("fallback must be finite");
  }

  return Math.min(Math.max(finiteValue, min), max);
};

export const commitRelativityInputs = (
  inputs: RelativityInputs,
): RelativityInputs =>
  validateRelativityInputs({
    initialDimensions: {
      x: clampFiniteNumber(
        inputs.initialDimensions.x,
        MIN_INITIAL_LENGTH,
        Number.MAX_VALUE,
        MIN_INITIAL_LENGTH,
      ),
      y: clampFiniteNumber(
        inputs.initialDimensions.y,
        MIN_INITIAL_LENGTH,
        Number.MAX_VALUE,
        MIN_INITIAL_LENGTH,
      ),
      z: clampFiniteNumber(
        inputs.initialDimensions.z,
        MIN_INITIAL_LENGTH,
        Number.MAX_VALUE,
        MIN_INITIAL_LENGTH,
      ),
    },
    velocity: {
      x: clampFiniteNumber(inputs.velocity.x, MIN_VELOCITY, MAX_VELOCITY, 0),
      y: clampFiniteNumber(inputs.velocity.y, MIN_VELOCITY, MAX_VELOCITY, 0),
      z: clampFiniteNumber(inputs.velocity.z, MIN_VELOCITY, MAX_VELOCITY, 0),
    },
    rotationSpeed: clampFiniteNumber(
      inputs.rotationSpeed,
      MIN_ROTATION_SPEED,
      MAX_ROTATION_SPEED,
      MIN_ROTATION_SPEED,
    ),
    scale: clampFiniteNumber(inputs.scale, MIN_SCALE, MAX_SCALE, 1),
  });

export const formatFractional = (value: number): string => {
  assertFiniteNumber("value", value);

  const rounded = Number(value.toFixed(6));
  const normalized = Object.is(rounded, -0) ? 0 : rounded;

  return String(normalized);
};
