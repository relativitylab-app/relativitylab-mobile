type BabelApi = {
  readonly cache: (enabled: boolean) => void;
};

describe("babel config", () => {
  it("relies on the Expo preset alone for native class static blocks", () => {
    const babelConfig = require("../babel.config.js") as (
      api: BabelApi,
    ) => {
      readonly presets: readonly unknown[];
      readonly plugins?: readonly string[];
    };
    const cache = jest.fn();

    const config = babelConfig({ cache });

    expect(cache).toHaveBeenCalledWith(true);
    expect(config.presets).toEqual([
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ]);
    // babel-preset-expo handles the Three.js static blocks that previously
    // needed @babel/plugin-transform-class-static-block, so the standalone
    // transform must not come back.
    expect(config.plugins ?? []).toEqual([]);
  });
});
