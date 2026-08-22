import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";

const canvasProps: Record<string, unknown>[] = [];

jest.mock("@react-three/fiber/native", () => ({
  Canvas: (props: Record<string, unknown>) => {
    canvasProps.push(props);
    return null;
  },
  useFrame: jest.fn(),
  useThree: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      camera: { position: { z: 0 }, updateProjectionMatrix: jest.fn() },
      scene: { background: null, environment: null },
    }),
  useLoader: Object.assign(
    jest.fn(() => Array.from({ length: 6 }, () => ({}))),
    { clear: jest.fn() },
  ),
  addAfterEffect: jest.fn(() => jest.fn()),
}));

describe("scene interaction", () => {
  let renderer: ReactTestRenderer | null = null;

  const render = (element: React.ReactElement) => {
    act(() => {
      renderer = create(element);
    });
  };

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
    canvasProps.length = 0;
  });

  // React Three Fiber's native Canvas lays an absolutely positioned overlay
  // over itself carrying a PanResponder that claims touches in the capture
  // phase. Under the new architecture a descendant opting in overrides an
  // ancestor opting out, so the wrapper's pointerEvents cannot stop it and the
  // scenes must decline the overlay themselves.
  it("declines the Canvas pointer overlay in the cube lab", () => {
    const { CubeLabScene } = require("@/components/scene/CubeLabScene");

    render(
      <CubeLabScene
        autoRotate={false}
        cameraDistance={6}
        dimensions={{ x: 1, y: 1, z: 1 }}
        onError={jest.fn()}
        onReady={jest.fn()}
        orientation={{ x: 0, y: 0 }}
        retryKey={0}
        rotationSpeed={0}
      />,
    );

    expect(canvasProps).not.toHaveLength(0);
    expect(canvasProps.map((props) => props.pointerEvents)).toEqual(
      canvasProps.map(() => "none"),
    );
  });

  it("declines the Canvas pointer overlay in the globe background", () => {
    const { GlobeBackground } = require("@/components/scene/GlobeBackground");

    render(<GlobeBackground onError={jest.fn()} />);

    expect(canvasProps).not.toHaveLength(0);
    expect(canvasProps.map((props) => props.pointerEvents)).toEqual(
      canvasProps.map(() => "none"),
    );
  });
});
