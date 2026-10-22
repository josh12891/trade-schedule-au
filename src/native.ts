import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";

const NAVY = "#0B1F33";

export async function setupNativeShell(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: Style.Light });
    if (Capacitor.getPlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: NAVY });
      await StatusBar.setOverlaysWebView({ overlay: false });
    }
  } catch {
    // Status bar plugin is absent in some browser previews.
  }
  try {
    await SplashScreen.hide();
  } catch {
    // Splash is only present on device builds.
  }
}
