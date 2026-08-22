module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testPathIgnorePatterns: ["<rootDir>/test/rules/"],
  moduleNameMapper: {
    // Under the react-native export condition lucide-react-native resolves to
    // an ES module, and the preset only transforms .js/.jsx/.ts/.tsx. Point the
    // tests at the functionally identical CommonJS build instead.
    "^lucide-react-native$":
      "<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js",
  },
};
