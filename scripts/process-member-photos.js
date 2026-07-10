const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { removeBackground } = require("@imgly/background-removal-node");

const ICON_DIR = "c:\\Users\\heiin\\Desktop\\童軍管理平台\\ICON";
const OUT_DIR = path.join(__dirname, "..", "assets", "members");
const MEMBERS_PATH = path.join(__dirname, "..", "data", "members.json");

const CANVAS_W = 220;
const CANVAS_H = 400;

const DEMO_FILENAMES = {
  盧羿衡: "lu-yiheng.png",
  吳溢潼: "wu-yitong.png",
  吳承軒: "wu-chengxuan.png",
};

function pickIconFiles(dir) {
  const byName = new Map();
  for (const file of fs.readdirSync(dir)) {
    const ext = path.extname(file).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) continue;
    const name = path.basename(file, ext);
    const full = path.join(dir, file);
    const size = fs.statSync(full).size;
    const prev = byName.get(name);
    // Prefer larger file when duplicates exist (e.g. 胡喬立.jpg / .jpeg)
    if (!prev || size > prev.size) {
      byName.set(name, { name, full, size, ext });
    }
  }
  return byName;
}

function outFilename(member) {
  if (DEMO_FILENAMES[member.name]) return DEMO_FILENAMES[member.name];
  return `${member.scoutId}.png`;
}

async function fitToCanvas(pngBuffer) {
  const trimmed = await sharp(pngBuffer)
    .trim({ threshold: 8 })
    .ensureAlpha()
    .png()
    .toBuffer();

  const meta = await sharp(trimmed).metadata();
  const maxW = CANVAS_W;
  const maxH = CANVAS_H;
  const fitScale = Math.min(maxW / meta.width, maxH / meta.height);
  const tw = Math.max(1, Math.round(meta.width * fitScale));
  const th = Math.max(1, Math.round(meta.height * fitScale));

  const resized = await sharp(trimmed)
    .resize(tw, th, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();

  const left = Math.round((CANVAS_W - tw) / 2);
  const top = CANVAS_H - th; // bottom-aligned like CSS object-position: center bottom

  return sharp({
    create: {
      width: CANVAS_W,
      height: CANVAS_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer();
}

async function processOne(srcPath, outPath) {
  console.log("processing", path.basename(srcPath), "->", path.basename(outPath));
  // Normalize to PNG buffer/blob so imgly can decode reliably on Windows
  const pngBuffer = await sharp(srcPath).rotate().png().toBuffer();
  const inputBlob = new Blob([pngBuffer], { type: "image/png" });
  const blob = await removeBackground(inputBlob, {
    model: "medium",
    output: { format: "image/png", quality: 0.9 },
  });
  const cutout = Buffer.from(await blob.arrayBuffer());
  const canvas = await fitToCanvas(cutout);
  fs.writeFileSync(outPath, canvas);
  const meta = await sharp(canvas).metadata();
  console.log("  done", meta.width, "x", meta.height, "alpha=", meta.hasAlpha);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const icons = pickIconFiles(ICON_DIR);
  const data = JSON.parse(fs.readFileSync(MEMBERS_PATH, "utf8"));
  const members = data.members || data;

  let updated = 0;
  const missing = [];
  const processed = [];

  for (const member of members) {
    const icon = icons.get(member.name);
    if (!icon) {
      if (!DEMO_FILENAMES[member.name]) missing.push(member.name);
      continue;
    }

    const filename = outFilename(member);
    const outPath = path.join(OUT_DIR, filename);
    await processOne(icon.full, outPath);
    member.photo = `assets/members/${filename}`;
    updated++;
    processed.push(`${member.name} -> ${filename}`);
    icons.delete(member.name);
  }

  fs.writeFileSync(MEMBERS_PATH, JSON.stringify(data, null, 2) + "\n");

  console.log("\nupdated", updated);
  processed.forEach((l) => console.log(" ", l));
  if (icons.size) {
    console.log("\nunmatched ICON files:");
    for (const [name] of icons) console.log(" ", name);
  }
  if (missing.length) {
    console.log("\nmembers without ICON:");
    missing.forEach((n) => console.log(" ", n));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
