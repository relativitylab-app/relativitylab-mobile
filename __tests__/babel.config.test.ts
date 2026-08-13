type BabelApi = {
  readonly cache: (enabled: boolean) => void;
};

describe("babel config", () => {
  it("keeps the native export class static block transform enabled", () => {
    const babelConfig = require("../babel.config.js") as (
      api: BabelApi,
    ) => {
      readonly presets: readonly unknown[];
      readonly plugins: readonly string[];
    };
    const cache = jest.fn();

    const config = babelConfig({ cache });

    expect(cache).toHaveBeenCalledWith(true);
    expect(config.presets).toEqual([
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ]);
    expect(config.plugins).toContain("@babel/plugin-transform-class-static-block");
  });
});
