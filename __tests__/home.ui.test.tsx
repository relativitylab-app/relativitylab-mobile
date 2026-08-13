import React from "react";
import { TouchableOpacity } from "react-native";
import { create, ReactTestRenderer } from "react-test-renderer";

const LinkMock = ({ children }: { readonly children: React.ReactNode }) => <>{children}</>;
let authState = {
  status: "authenticated",
  user: { displayName: "Ada", email: "ada@example.com" },
};

const collectText = (node: unknown): string[] => {
  if (typeof node === "string") {
    return [node];
  }

  if (Array.isArray(node)) {
    return node.flatMap(collectText);
  }

  if (typeof node === "object" && node !== null && "children" in node) {
    return collectText((node as { readonly children?: unknown }).children);
  }

  return [];
};

const textContent = (renderer: ReactTestRenderer): string[] =>
  collectText(renderer.toJSON());

const loadHome = () => {
  jest.resetModules();
  jest.doMock("react", () => React);
  jest.doMock("expo-router", () => ({ Link: LinkMock }));
  jest.doMock("@/providers/AuthProvider", () => ({
    useAuth: () => authState,
  }));

  return require("../app/(root)/(tabs)/index").default as React.ComponentType;
};

describe("home UI", () => {
  beforeEach(() => {
    authState = {
      status: "authenticated",
      user: { displayName: "Ada", email: "ada@example.com" },
    };
  });

  it("renders identity greeting and native Lab/Quiz entries", () => {
    const Home = loadHome();
    const renderer = create(<Home />);

    expect(textContent(renderer)).toEqual(
      expect.arrayContaining(["Ada", "Lab", "Quiz"]),
    );
    expect(renderer.root.findAllByType(TouchableOpacity)).toHaveLength(2);
  });
});
