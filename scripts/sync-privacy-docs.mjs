import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = path.join(root, "docs");

mkdirSync(docsDir, { recursive: true });
copyFileSync(path.join(root, "public", "privacy.html"), path.join(docsDir, "privacy.html"));
