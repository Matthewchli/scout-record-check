const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SRC_ROOT = "c:\\Users\\heiin\\Desktop\\童軍管理平台\\童軍專科徽章";
const DST_ROOT = path.join(__dirname, "..", "assets", "specialty");

const GROUPS = [
  { src: "興趣組", dest: "interest" },
  { src: "技能組", dest: "skill" },
  { src: "服務組", dest: "service" },
  { src: "教導組", dest: "instructor" },
  { src: "其他獎章及徽章", dest: "other" },
];

function isNearWhite(r, g, b, threshold = 232) {
  return r >= threshold && g >= threshold && b >= threshold;
}

async function toTransparentPng(srcPath, outPath) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Buffer.from(data);
  const { width, height, channels } = info;
  const visited = new Uint8Array(width * height);
  const stack = [];

  function push(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const i = idx * channels;
    if (!isNearWhite(pixels[i], pixels[i + 1], pixels[i + 2])) return;
    visited[idx] = 1;
    stack.push(idx);
  }

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
    pixels[idx * channels + 3] = 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  // Trim transparent margins so no empty white-looking padding remains
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = pixels[(y * width + x) * channels + 3];
      if (a < 8) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  let outBuffer = pixels;
  let outWidth = width;
  let outHeight = height;

  if (maxX >= minX && maxY >= minY) {
    const pad = 2;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(width - 1, maxX + pad);
    maxY = Math.min(height - 1, maxY + pad);
    outWidth = maxX - minX + 1;
    outHeight = maxY - minY + 1;
    outBuffer = Buffer.alloc(outWidth * outHeight * channels);
    for (let y = 0; y < outHeight; y++) {
      for (let x = 0; x < outWidth; x++) {
        const si = ((minY + y) * width + (minX + x)) * channels;
        const di = (y * outWidth + x) * channels;
        outBuffer[di] = pixels[si];
        outBuffer[di + 1] = pixels[si + 1];
        outBuffer[di + 2] = pixels[si + 2];
        outBuffer[di + 3] = pixels[si + 3];
      }
    }
  }

  await sharp(outBuffer, {
    raw: { width: outWidth, height: outHeight, channels },
  })
    .png()
    .toFile(outPath);
}

function cleanBaseName(file) {
  // e.g. 樹木護理.emf.jpg -> 樹木護理
  return path
    .basename(file)
    .replace(/\.emf\.jpe?g$/i, "")
    .replace(/\.jpe?g$/i, "")
    .replace(/\.png$/i, "");
}

(async () => {
  let total = 0;

  for (const group of GROUPS) {
    const srcDir = path.join(SRC_ROOT, group.src);
    const dstDir = path.join(DST_ROOT, group.dest);
    if (!fs.existsSync(srcDir)) {
      console.warn("missing source", srcDir);
      continue;
    }

    fs.mkdirSync(dstDir, { recursive: true });
    for (const f of fs.readdirSync(dstDir)) {
      fs.unlinkSync(path.join(dstDir, f));
    }

    const files = fs
      .readdirSync(srcDir)
      .filter((f) => /\.(jpe?g|png)$/i.test(f));

    console.log(`\n=== ${group.src} -> ${group.dest} (${files.length}) ===`);
    for (const file of files) {
      const base = cleanBaseName(file);
      const out = path.join(dstDir, `${base}.png`);
      await toTransparentPng(path.join(srcDir, file), out);
      console.log("ok", `${group.dest}/${base}.png`);
      total++;
    }
  }

  // Assign icons on earned specialty badges
  const membersPath = path.join(__dirname, "..", "data", "members.json");
  const data = JSON.parse(fs.readFileSync(membersPath, "utf8"));
  const groupFolders = Object.fromEntries(GROUPS.map((g) => [g.dest, g.dest]));

  function resolveIcon(badge) {
    const group =
      badge.group ||
      ({
        興趣組: "interest",
        技能組: "skill",
        服務組: "service",
        教導組: "instructor",
        其他獎章及徽章: "other",
        其他: "other",
      }[badge.category] || "other");

    if (!groupFolders[group]) return null;

    const raw = String(badge.name || "")
      .replace(/（教導組）/g, "")
      .replace(/\(教導組\)/g, "")
      .trim();

    const candidates = [
      raw,
      raw.replace(/章$/, ""),
      raw.replace(/獎章$/, ""),
      raw.replace(/徽章$/, ""),
    ];

    for (const base of candidates) {
      if (!base) continue;
      const rel = `assets/specialty/${group}/${base}.png`;
      if (fs.existsSync(path.join(__dirname, "..", rel))) return rel;
    }
    return null;
  }

  let linked = 0;
  for (const m of data.members) {
    for (const b of m.specialtyBadges || []) {
      const icon = resolveIcon(b);
      if (icon) {
        b.icon = icon;
        linked++;
      } else if (b.icon) {
        b.icon = b.icon.replace(/\.jpe?g$/i, ".png");
      }
    }
  }

  fs.writeFileSync(membersPath, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`\ndone images=${total} linked=${linked}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
