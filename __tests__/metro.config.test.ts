import fs from "node:fs";
import path from "node:path";

// metro.config.js pulls in expo/metro-config and nativewind/metro, which ship
// syntax the Jest transform does not cover, so this asserts on the source the
// way the security boundary suite asserts on app.config.ts.
const source = fs.readFileSync(
  path.join(__dirname, "..", "metro.config.js"),
  "utf8",
);

describe("metro config", () => {
  it("pins every Three.js import to the CommonJS build", () => {
    // React Three Fiber's native entry is CommonJS and patches TextureLoader on
    // the CJS build. Three.js resolves ESM and CJS through separate exports
    // conditions, so without this pin an ESM import loads a second instance
    // whose loader still reaches for the DOM and throws on device.
    expect(source).toContain('moduleName === "three"');
    expect(source).toContain("node_modules/three/build/three.cjs");
  });

  it("delegates every other module to the upstream resolver", () => {
    expect(source).toMatch(/upstreamResolveRequest\s*\?\?\s*context\.resolveRequest/);
    expect(source).toContain("return resolve(context, moduleName, platform);");
  });

  it("keeps the NativeWind integration", () => {
    expect(source).toContain("withNativeWind");
    expect(source).toContain("./app/global.css");
  });
});
