import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.smcf.app",
  appName: "SMCF",
  webDir: "dist",
  server: {
    androidScheme: "https",
    cleartext: true,
    hostname: "localhost",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#1e293b",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      androidSplashResourceName: "splash",
      splashFullScreen: true,
      splashImmersive: true,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_notify",
      iconColor: "#3b82f6",
      sound: "notification.wav",
    },
  },
};

export default config;
