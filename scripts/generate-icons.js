// Genera los íconos PNG necesarios para la PWA desde logo.png
import sharp from "sharp";
import { existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dir, "../public");
const logoPath  = resolve(publicDir, "logo.png");

mkdirSync(publicDir, { recursive: true });

if (!existsSync(logoPath)) {
  console.error("❌  No se encontró public/logo.png — guarda el logo ahí primero.");
  process.exit(1);
}

const sizes = [
  { name: "apple-touch-icon.png", size: 180 },
  { name: "icon-192.png",         size: 192 },
  { name: "icon-512.png",         size: 512 },
  { name: "icon-maskable.png",    size: 512 },
];

for (const { name, size } of sizes) {
  const outPath = resolve(publicDir, name);
  await sharp(logoPath)
    .resize(size, size, { fit: "contain", background: { r: 7, g: 8, b: 18, alpha: 1 } })
    .png()
    .toFile(outPath);
  console.log(`✅  ${name} (${size}×${size})`);
}

console.log("\n🐼  Íconos generados desde logo.png en /public");
