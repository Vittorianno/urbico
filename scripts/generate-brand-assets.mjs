// scripts/generate-brand-assets.mjs
//
// Regenera todos os PNGs de marca (ícone do app, ícone adaptativo Android,
// splash, favicon, ícone de notificação, avatar do Norby) a partir das fontes
// vetoriais em assets/brand/svg/. Rode sempre que um SVG de marca mudar.
//
// Uso:
//   pnpm add -D sharp   (uma vez só)
//   node scripts/generate-brand-assets.mjs
//
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const svgDir = path.join(root, "assets/brand/svg");
const outDir = path.join(root, "assets/images");

const jobs = [
  // ícone principal do app (usado por icon, favicon e splash no app.config.ts)
  { svg: "icon-mark-full.svg", out: "icon.png", size: 1024 },
  { svg: "icon-mark-full.svg", out: "favicon.png", size: 256 },
  { svg: "icon-mark-full.svg", out: "splash-icon.png", size: 1024 },

  // ícone adaptativo Android (três camadas)
  { svg: "android-icon-background.svg", out: "android-icon-background.png", size: 1024 },
  { svg: "android-icon-foreground.svg", out: "android-icon-foreground.png", size: 1024 },
  { svg: "android-icon-monochrome.svg", out: "android-icon-monochrome.png", size: 1024 },

  // ícone de notificação (silhueta branca simples)
  { svg: "notification-icon.svg", out: "notification-icon.png", size: 192 },

  // marca e avatar do Norby para uso dentro do app
  { svg: "norby-avatar.svg", out: "norby-avatar.png", size: 400 },
];

async function run() {
  fs.mkdirSync(outDir, { recursive: true });
  for (const job of jobs) {
    const svgPath = path.join(svgDir, job.svg);
    const outPath = path.join(outDir, job.out);
    const svg = fs.readFileSync(svgPath, "utf8");
    await sharp(Buffer.from(svg), { density: 300 })
      .resize(job.size, job.size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outPath);
    console.log(`✓ ${job.out} (${job.size}x${job.size})`);
  }
  console.log("\nPronto. Confira assets/images/ e rode o app para validar.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
