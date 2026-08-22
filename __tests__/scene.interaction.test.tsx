import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";

const mockCanvas = { props: [] as Record<string, unknown>[], mounts: 0 };

jest.mock("@react-three/fiber/native", () => ({
  Canvas: (props: Record<string, unknown>) => {
    const react = require("react") as typeof React;
    mockCanvas.props.push(props);
    // An empty dependency list runs once per mount, so a changed key shows up
    // here as a fresh mount rather than as another render.
    react.useEffect(() => {
      mockCanvas.mounts += 1;
    }, []);
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

const CUBE_LABEL =
  "Three-dimensional relativity cube with red X, green Y, and blue Z axes";

describe("scene interaction", () => {
  let renderer: ReactTestRenderer | null = null;

  const render = (element: React.ReactElement) => {
    act(() => {
      renderer = create(element);
    });
  };

  const renderCube = () => {
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
  };

  const resizeTo = (height: number) => {
    const wrapper = renderer!.root.find(
      (node) => node.props.accessibilityLabel === CUBE_LABEL,
    );
    act(() => {
      wrapper.props.onLayout({
        nativeEvent: { layout: { height, width: 320, x: 0, y: 0 } },
      });
    });
  };

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
    mockCanvas.props.length = 0;
    mockCanvas.mounts = 0;
  });

  // React Three Fiber's native Canvas lays an absolutely positioned overlay
  // over itself carrying a PanResponder that claims touches in the capture
  // phase. Under the new architecture a descendant opting in overrides an
  // ancestor opting out, so the wrapper's pointerEvents cannot stop it and the
  // scenes must decline the overlay themselves.
  it("declines the Canvas pointer overlay in the cube lab", () => {
    renderCube();

    expect(mockCanvas.props).not.toHaveLength(0);
    expect(mockCanvas.props.map((props) => props.pointerEvents)).toEqual(
      mockCanvas.props.map(() => "none"),
    );
  });

  it("declines the Canvas pointer overlay in the globe background", () => {
    const { GlobeBackground } = require("@/components/scene/GlobeBackground");

    render(<GlobeBackground onError={jest.fn()} />);

    expect(mockCanvas.props).not.toHaveLength(0);
    expect(mockCanvas.props.map((props) => props.pointerEvents)).toEqual(
      mockCanvas.props.map(() => "none"),
    );
  });

  it("rebuilds the surface when the region changes height", () => {
    renderCube();
    resizeTo(600);
    const afterTall = mockCanvas.mounts;

    resizeTo(180);

    // EXGL builds its drawing buffer once and cannot resize it, so a surface
    // made for the tall region is stretched into the short one and flattens
    // the scene until it is rebuilt.
    expect(mockCanvas.mounts).toBeGreaterThan(afterTall);
  });

  it("keeps the surface across layout jitter", () => {
    renderCube();
    resizeTo(600);
    const settled = mockCanvas.mounts;

    resizeTo(610);
    resizeTo(595);

    // Rebuilding drops the GL context, so only a meaningful change may do it.
    expect(mockCanvas.mounts).toBe(settled);
  });
});
