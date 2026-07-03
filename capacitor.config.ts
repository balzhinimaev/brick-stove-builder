import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ru.brickstove.app",
  appName: "Brick Stove Builder",
  webDir: "dist",
  android: {
    // Debug builds talk to plain-HTTP/dev backends; harmless for a release that
    // points VITE_API_BASE at an HTTPS origin.
    allowMixedContent: true
  }
};

export default config;
