const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const srcDir = "c:\\Users\\heiin\\Desktop\\童軍管理平台\\童軍專科徽章\\興趣組";
const dstDir = path.join(__dirname, "..", "assets", "specialty", "interest");

async function toTransparentPng(srcPath, outPath) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Buffer.from(data);
  const { width, height, channels } = info;
  const threshold = 235;

  // Flood-fill from corners / edges to clear outer white background only
  const visited = new Uint8Array(width * height);
  const stack = [];

  function push(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const i = idx * channels;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    if (r < threshold || g < threshold || b < threshold) return;
    visited[idx] = 1;
    stack.push(idx);
  }

  // seed from all edge pixels
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (stack.length) {
    const idx = stack.pop();
    const x = idx % width;
    const y = (idx / width) | 0;
    const i = idx * channels;
    pixels[i + 3] = 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  await sharp(pixels, {
    raw: { width, height, channels },
  })
    .png()
    .toFile(outPath);
}

(async () => {
  fs.mkdirSync(dstDir, { recursive: true });
  // clear old files
  for (const f of fs.readdirSync(dstDir)) {
    fs.unlinkSync(path.join(dstDir, f));
  }

  const files = fs.readdirSync(srcDir).filter((f) => /\.jpe?g$/i.test(f));
  for (const file of files) {
    const base = path.basename(file, path.extname(file));
    const out = path.join(dstDir, `${base}.png`);
    await toTransparentPng(path.join(srcDir, file), out);
    console.log("ok", base + ".png");
  }

  const membersPath = path.join(__dirname, "..", "data", "members.json");
  const data = JSON.parse(fs.readFileSync(membersPath, "utf8"));
  for (const m of data.members) {
    for (const b of m.specialtyBadges || []) {
      if (b.icon) b.icon = b.icon.replace(/\.jpe?g$/i, ".png");
    }
  }
  fs.writeFileSync(membersPath, JSON.stringify(data, null, 2), "utf8");
  console.log("done", files.length);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
