import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import {
  buildSchedulePdf,
  downloadTradeSchedule,
  scheduleFileName,
  type SchedulePdfInput,
} from "@/lib/schedule-pdf";

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

/** Browser uses the anchor download. The native WebView shares the PDF file. */
export async function saveTradeSchedule(input: SchedulePdfInput) {
  if (!Capacitor.isNativePlatform()) {
    downloadTradeSchedule(input);
    return;
  }

  const bytes = buildSchedulePdf(input);
  const name = scheduleFileName(input.jobName);
  const written = await Filesystem.writeFile({
    path: name,
    data: bytesToBase64(bytes),
    directory: Directory.Cache,
  });
  await Share.share({
    title: input.jobName.trim() || "Trade Schedule",
    text: "Trade schedule PDF",
    files: [written.uri],
    dialogTitle: "Save schedule",
  });
}
