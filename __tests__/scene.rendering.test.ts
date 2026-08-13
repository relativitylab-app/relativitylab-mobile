import { createSceneFrameReadiness } from "@/components/scene/renderReadiness";

describe("scene render readiness", () => {
  it("does not signal ready until a scene frame successfully reaches after-render", () => {
    const onReady = jest.fn();
    const readiness = createSceneFrameReadiness(onReady);

    readiness.afterRender();
    expect(onReady).not.toHaveBeenCalled();
    readiness.beforeRender();
    expect(onReady).not.toHaveBeenCalled();
    readiness.afterRender();
    expect(onReady).toHaveBeenCalledTimes(1);
    readiness.beforeRender();
    readiness.afterRender();
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});
