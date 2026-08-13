import {
  calculateRelativityDimensions,
  formatFractional,
  MAX_ROTATION_SPEED,
  MAX_SCALE,
  MAX_VELOCITY,
  MIN_INITIAL_LENGTH,
  MIN_ROTATION_SPEED,
  MIN_SCALE,
  MIN_VELOCITY,
  RelativityDimensions,
  RelativityInputs,
} from "@/domain/relativity";

export const LAB_AXES = ["x", "y", "z"] as const;

export type LabAxis = (typeof LAB_AXES)[number];
export type LabNumericKind =
  | "initialLength"
  | "velocity"
  | "rotationSpeed"
  | "scale";

export interface LabOrientation {
  readonly x: number;
  readonly y: number;
}

export interface LabState {
  readonly axes: Readonly<
    Record<
      LabAxis,
      {
        readonly initialLength: number;
        readonly velocity: number;
        readonly finalLength: number;
        readonly gamma: number;
      }
    >
  >;
  readonly dimensions: RelativityDimensions;
  readonly scale: number;
  readonly rotationSpeed: number;
  readonly autoRotate: boolean;
}

export interface NumericCommitResult {
  readonly value: number | null;
  readonly text: string;
  readonly issue: "invalid" | "clamped" | null;
}

export type SceneFailureCategory =
  | "asset"
  | "context"
  | "shader"
  | "render";

export interface SceneFailure {
  readonly category: SceneFailureCategory;
  readonly retryable: true;
}

export const DEFAULT_LAB_INPUTS: RelativityInputs = Object.freeze({
  initialDimensions: Object.freeze({ x: 1, y: 1, z: 1 }),
  velocity: Object.freeze({ x: 0, y: 0, z: 0 }),
  rotationSpeed: 0.1,
  scale: 0.4,
});

export const DEFAULT_LAB_ORIENTATION: LabOrientation = Object.freeze({
  x: -0.32,
  y: 0.58,
});

export const MAX_VERTICAL_ROTATION = (85 * Math.PI) / 180;
export const MIN_CAMERA_DISTANCE = 2.4;
export const MAX_CAMERA_DISTANCE = 8;
export const DEFAULT_CAMERA_DISTANCE = 4.5;

const boundsFor = (kind: LabNumericKind): readonly [number, number] => {
  switch (kind) {
    case "initialLength":
      return [MIN_INITIAL_LENGTH, Number.MAX_VALUE];
    case "velocity":
      return [MIN_VELOCITY, MAX_VELOCITY];
    case "rotationSpeed":
      return [MIN_ROTATION_SPEED, MAX_ROTATION_SPEED];
    case "scale":
      return [MIN_SCALE, MAX_SCALE];
  }
};

export const parseFiniteDraft = (text: string): number | null => {
  if (text.trim() === "") {
    return null;
  }

  const value = Number(text);
  return Number.isFinite(value) ? value : null;
};

export const readLiveLabValue = (
  text: string,
  kind: LabNumericKind,
): number | null => {
  const value = parseFiniteDraft(text);
  if (value === null) {
    return null;
  }

  const [minimum, maximum] = boundsFor(kind);
  return value >= minimum && value <= maximum ? value : null;
};

export const commitLabNumericDraft = (
  text: string,
  kind: LabNumericKind,
): NumericCommitResult => {
  const value = parseFiniteDraft(text);
  if (value === null) {
    return { value: null, text, issue: "invalid" };
  }

  const [minimum, maximum] = boundsFor(kind);
  const clamped = Math.min(Math.max(value, minimum), maximum);
  return {
    value: clamped,
    text: formatFractional(clamped),
    issue: clamped === value ? null : "clamped",
  };
};

export const createLabState = (
  inputs: RelativityInputs = DEFAULT_LAB_INPUTS,
  autoRotate = true,
): LabState => {
  const dimensions = calculateRelativityDimensions(inputs);

  return {
    axes: {
      x: {
        initialLength: dimensions.initialDimensions.x,
        velocity: inputs.velocity.x,
        finalLength: dimensions.contractedDimensions.x,
        gamma: dimensions.gamma.x,
      },
      y: {
        initialLength: dimensions.initialDimensions.y,
        velocity: inputs.velocity.y,
        finalLength: dimensions.contractedDimensions.y,
        gamma: dimensions.gamma.y,
      },
      z: {
        initialLength: dimensions.initialDimensions.z,
        velocity: inputs.velocity.z,
        finalLength: dimensions.contractedDimensions.z,
        gamma: dimensions.gamma.z,
      },
    },
    dimensions,
    scale: inputs.scale,
    rotationSpeed: inputs.rotationSpeed,
    autoRotate,
  };
};

export const updateLabAxis = (
  inputs: RelativityInputs,
  axis: LabAxis,
  kind: "initialLength" | "velocity",
  value: number,
): RelativityInputs => {
  if (kind === "initialLength") {
    return {
      ...inputs,
      initialDimensions: { ...inputs.initialDimensions, [axis]: value },
    };
  }

  return {
    ...inputs,
    velocity: { ...inputs.velocity, [axis]: value },
  };
};

export const updateLabControl = (
  inputs: RelativityInputs,
  kind: "rotationSpeed" | "scale",
  value: number,
): RelativityInputs => ({ ...inputs, [kind]: value });

export const applyLabDrag = (
  origin: LabOrientation,
  dx: number,
  dy: number,
  sensitivity = 0.008,
): LabOrientation => ({
  x: Math.min(
    Math.max(origin.x + dy * sensitivity, -MAX_VERTICAL_ROTATION),
    MAX_VERTICAL_ROTATION,
  ),
  y: origin.y + dx * sensitivity,
});

export const applyCameraZoom = (
  distance: number,
  delta: number,
): number =>
  Math.min(
    Math.max(distance + delta, MIN_CAMERA_DISTANCE),
    MAX_CAMERA_DISTANCE,
  );

export const formatLabValue = (value: number): string =>
  formatFractional(value);

export const classifySceneError = (error: Error): SceneFailure => {
  const message = `${error.name} ${error.message}`.toLowerCase();

  if (
    message.includes("texture") ||
    message.includes("image") ||
    message.includes("asset")
  ) {
    return { category: "asset", retryable: true };
  }
  if (message.includes("shader")) {
    return { category: "shader", retryable: true };
  }
  if (
    message.includes("context") ||
    message.includes("webgl") ||
    message.includes("glview")
  ) {
    return { category: "context", retryable: true };
  }
  return { category: "render", retryable: true };
};
