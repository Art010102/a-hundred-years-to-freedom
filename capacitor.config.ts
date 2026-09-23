import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.hundredyears.freedom",
  appName: "A Hundred Years to Freedom",
  webDir: "www",
  android: {
    allowMixedContent: false,
  },
};

export default config;
