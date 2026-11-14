import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assets = path.join(__dirname, "..", "assets");

const WHITE = 245;
const BLACK = 28;

async function stripFlatBg(srcName, outName, mode) {
  const input = path.join(assets, srcName);
  const output = path.join(assets, outName);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
  const white = r >= WHITE && g >= WHITE && b >= WHITE;
  const black = r <= BLACK && g <= BLACK && b <= BLACK;
    if ((mode === "white" && white) || (mode === "black" && black) || (mode === "both" && (white || black))) {
      data[i + 3] = 0;
    }
  }

  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(output);

  console.log("Wrote", output);
}

const args = process.argv.slice(2);
if (args.length >= 3) {
  await stripFlatBg(args[0], args[1], args[2]);
} else {
  await stripFlatBg("ucc-logo-form.png", "ucc-logo-form.png", "white");
  await stripFlatBg("ucc-logo-hero-source.png", "ucc-logo-hero.png", "black");
}