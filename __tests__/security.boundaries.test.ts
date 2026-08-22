import fs from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(__dirname, "..");
const productionRoots = [
  "app",
  "components",
  "constants",
  "domain",
  "infrastructure",
  "providers",
];

const collectSourceFiles = (relativePath: string): string[] => {
  const absolutePath = path.join(repositoryRoot, relativePath);
  const stat = fs.statSync(absolutePath);

  if (stat.isFile()) {
    return /\.(?:js|ts|tsx)$/.test(relativePath) ? [relativePath] : [];
  }

  return fs
    .readdirSync(absolutePath)
    .flatMap((entry) => collectSourceFiles(path.join(relativePath, entry)));
};

const productionFiles = productionRoots.flatMap(collectSourceFiles);
const read = (relativePath: string): string =>
  fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");

describe("native security boundaries", () => {
  it("keeps obsolete provider and browser packages out of direct dependencies", () => {
    const manifest = JSON.parse(read("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const packages = {
      ...manifest.dependencies,
      ...manifest.devDependencies,
    };

    expect(packages).not.toHaveProperty("react-native-appwrite");
    expect(packages).not.toHaveProperty("react-native-webview");
    expect(packages).not.toHaveProperty("react-native-url-polyfill");
    expect(packages).not.toHaveProperty("expo-web-browser");

    const lockfile = JSON.parse(read("package-lock.json")) as {
      packages?: Record<string, { dependencies?: Record<string, string> }>;
    };
    const rootDependencies = lockfile.packages?.[""]?.dependencies ?? {};

    expect(rootDependencies).not.toHaveProperty("react-native-appwrite");
    expect(rootDependencies).not.toHaveProperty("react-native-webview");
    expect(rootDependencies).not.toHaveProperty("react-native-url-polyfill");
    expect(rootDependencies).not.toHaveProperty("expo-web-browser");
  });

  it("has no obsolete provider, browser-auth, WebView, or DOM runtime path", () => {
    const forbidden = [
      /react-native-appwrite/,
      /react-native-webview/,
      /createOAuth2Token/,
      /openAuthSessionAsync/,
      /<WebView\b/,
      /\bwindow\s*\./,
      /\bdocument\s*\.\s*(?:body|createElement|getElementById|head|querySelector)/,
    ];

    for (const relativePath of productionFiles) {
      const source = read(relativePath);

      for (const pattern of forbidden) {
        expect({ relativePath, pattern, source }).not.toEqual(
          expect.objectContaining({ source: expect.stringMatching(pattern) }),
        );
      }
    }
  });

  it("keeps production logs free of credentials and answer/profile payloads", () => {
    for (const relativePath of productionFiles) {
      expect(read(relativePath)).not.toMatch(
        /console\.(?:log|debug|info|warn|error)\s*\(/,
      );
    }
  });

  it("keeps scene resources bundled and free of remote or HTML sources", () => {
    const sceneFiles = productionFiles.filter(
      (relativePath) =>
        relativePath.startsWith("components/scene/") ||
        relativePath === "domain/scene.ts" ||
        relativePath === path.join("app", "(root)", "playground.tsx") ||
        relativePath === path.join("app", "sign-in.tsx"),
    );

    for (const relativePath of sceneFiles) {
      const source = read(relativePath);

      expect(source).not.toMatch(/https?:\/\//);
      expect(source).not.toMatch(/source\s*=\s*\{\{\s*uri\s*:/);
      expect(source).not.toMatch(/<html\b|<script\b|srcDoc\s*=/i);
    }
  });

  it("keeps native provider configuration external to source control", () => {
    const appConfig = read("app.config.ts");
    const gitignore = read(".gitignore");

    expect(appConfig).toContain("process.env.GOOGLE_SERVICES_JSON");
    expect(appConfig).toContain("process.env.GOOGLE_SERVICE_INFO_PLIST");
    expect(appConfig).toContain("process.env.GOOGLE_SIGNIN_IOS_URL_SCHEME");
    expect(read("infrastructure/firebase/authGateway.ts")).toContain(
      'process.env["EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"]',
    );
    expect(gitignore).toMatch(/^google-services\.json$/m);
    expect(gitignore).toMatch(/^GoogleService-Info\.plist$/m);
  });

  it("matches the Android package against the injected service file when present", () => {
    const servicePath = path.join(repositoryRoot, "google-services.json");

    if (!fs.existsSync(servicePath)) {
      // The file is deliberately absent from version control, so this check
      // only runs where a real one has been injected.
      return;
    }

    const service = JSON.parse(fs.readFileSync(servicePath, "utf8")) as {
      readonly client?: readonly {
        readonly client_info?: {
          readonly android_client_info?: { readonly package_name?: string };
        };
      }[];
    };
    const registered = (service.client ?? [])
      .map((entry) => entry.client_info?.android_client_info?.package_name)
      .filter((name): name is string => typeof name === "string");
    const configured = read("app.config.ts").match(/package:\s*"([^"]+)"/)?.[1];

    // Gradle resolves the service file by applicationId, so a mismatch fails
    // the Android build rather than surfacing anywhere earlier.
    expect({ configured, registered }).toEqual({
      configured,
      registered: expect.arrayContaining([configured]),
    });
  });

  it("names only packages that actually ship an Expo config plugin", () => {
    const appConfig = read("app.config.ts");
    const named = [
      ...appConfig.matchAll(/"(@react-native-firebase\/[a-z]+|@react-native-google-signin\/[a-z-]+)"/g),
    ].map((match) => match[1]);
    const pluginPackages = [...new Set(named)].filter(
      (name) => name !== "@react-native-firebase/app",
    );

    // The app plugin is referenced through a variable, so assert it separately.
    expect(appConfig).toContain('"@react-native-firebase/app"');
    expect(pluginPackages.length).toBeGreaterThan(0);

    for (const name of ["@react-native-firebase/app", ...pluginPackages]) {
      // A package without app.plugin.js makes Expo load its entry point
      // instead, which fails config resolution outside credential-free mode.
      expect({
        name,
        hasPlugin: fs.existsSync(
          path.join(repositoryRoot, "node_modules", name, "app.plugin.js"),
        ),
      }).toEqual({ name, hasPlugin: true });
    }
  });
});
