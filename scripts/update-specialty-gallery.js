const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const SPECIALTY_ROOT = path.join(ROOT, "assets", "specialty");

const GROUP_ORDER = [
  { key: "interest", label: "興趣組" },
  { key: "skill", label: "技能組" },
  { key: "service", label: "服務組" },
  { key: "instructor", label: "教導組" },
  { key: "water", label: "水上活動組" },
  { key: "aviation", label: "航空活動組" },
  { key: "other", label: "其他獎章及徽章" },
];

const MOVES = [
  { name: "水手長", from: "other", to: "water" },
  { name: "水手", from: "other", to: "water" },
  { name: "艇工", from: "other", to: "water" },
  { name: "初級航空活動", from: "other", to: "aviation" },
  { name: "中級航空活動", from: "other", to: "aviation" },
  { name: "高級航空活動", from: "other", to: "aviation" },
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

function moveBadgeFiles() {
  for (const move of MOVES) {
    const src = path.join(SPECIALTY_ROOT, move.from, `${move.name}.png`);
    const destDir = path.join(SPECIALTY_ROOT, move.to);
    const dest = path.join(destDir, `${move.name}.png`);
    fs.mkdirSync(destDir, { recursive: true });
    if (!fs.existsSync(src)) {
      if (fs.existsSync(dest)) {
        console.log("already moved", move.to, move.name);
        continue;
      }
      console.warn("missing", src);
      continue;
    }
    fs.renameSync(src, dest);
    console.log("moved", `${move.from}/${move.name}.png`, "->", `${move.to}/${move.name}.png`);
  }
}

async function removeAllBackgrounds() {
  let total = 0;
  const os = require("os");
  for (const group of GROUP_ORDER) {
    const dir = path.join(SPECIALTY_ROOT, group.key);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => /\.png$/i.test(f) && !f.startsWith("."));
    console.log(`\n=== remove bg ${group.key} (${files.length}) ===`);
    for (const file of files) {
      const full = path.join(dir, file);
      const tmp = path.join(os.tmpdir(), `scout-badge-${group.key}-${Date.now()}-${file}`);
      await toTransparentPng(full, tmp);
      fs.copyFileSync(tmp, full);
      try {
        fs.unlinkSync(tmp);
      } catch (_) {
        /* ignore */
      }
      console.log("ok", `${group.key}/${file}`);
      total++;
    }
  }
  return total;
}

function mergeSeaAirSyllabus() {
  const syllabusPath = path.join(ROOT, "data", "specialty-syllabus.json");
  const seaAirPath = path.join(ROOT, "tmp", "sea-air-syllabus.json");
  const syllabus = JSON.parse(fs.readFileSync(syllabusPath, "utf8"));
  const seaAir = JSON.parse(fs.readFileSync(seaAirPath, "utf8"));

  const groupMap = {
    sea: { key: "water", category: "水上活動組" },
    air: { key: "aviation", category: "航空活動組" },
  };

  for (const badge of seaAir.badges || []) {
    const mapped = groupMap[badge.group];
    if (!mapped) continue;
    const key = `${mapped.key}:${badge.chineseName}`;
    syllabus.badges[key] = {
      key,
      name: badge.chineseName,
      englishName: badge.englishName || "",
      group: mapped.key,
      category: mapped.category,
      intro: "",
      note: badge.note || "",
      items: badge.items || [],
    };
    // Remove old other:* keys if present
    delete syllabus.badges[`other:${badge.chineseName}`];
    console.log("syllabus", key, `items=${(badge.items || []).length}`);
  }

  fs.writeFileSync(syllabusPath, JSON.stringify(syllabus, null, 2) + "\n", "utf8");
}

function writeGalleryJson() {
  const orderPath = path.join(ROOT, "data", "specialty-order.json");
  const orderData = fs.existsSync(orderPath)
    ? JSON.parse(fs.readFileSync(orderPath, "utf8"))
    : { groups: {} };

  function sortBySyllabusOrder(groupKey, names) {
    const order = orderData.groups?.[groupKey] || [];
    const rank = new Map(order.map((n, i) => [n, i]));
    return [...names].sort((a, b) => {
      const ra = rank.has(a) ? rank.get(a) : 9999;
      const rb = rank.has(b) ? rank.get(b) : 9999;
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b, "zh-Hant");
    });
  }

  const out = {
    generatedFrom: "assets/specialty",
    orderedBy: "data/specialty-order.json (FullVersion-zh.pdf)",
    groups: GROUP_ORDER.map((g) => {
      const dir = path.join(SPECIALTY_ROOT, g.key);
      const files = fs.existsSync(dir)
        ? fs
            .readdirSync(dir)
            .filter((f) => f.toLowerCase().endsWith(".png") && !f.startsWith("."))
        : [];
      const names = sortBySyllabusOrder(
        g.key,
        files.map((f) => f.replace(/\.png$/i, ""))
      );
      const items = names.map((name) => ({
        name,
        icon: `assets/specialty/${g.key}/${name}.png`,
        key: `${g.key}:${name}`,
      }));
      return { ...g, items };
    }).filter((g) => g.items.length > 0),
  };

  const outPath = path.join(ROOT, "data", "specialty-gallery.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(
    "\ngallery",
    out.groups.map((g) => `${g.key}:${g.items.length}`).join(", "),
    "total",
    out.groups.reduce((s, g) => s + g.items.length, 0)
  );
  // show first few of interest to verify order
  const interest = out.groups.find((g) => g.key === "interest");
  if (interest) {
    console.log(
      "interest order:",
      interest.items.map((i) => i.name).join("、")
    );
  }
}

function updateMemberIcons() {
  const membersPath = path.join(ROOT, "data", "members.json");
  const data = JSON.parse(fs.readFileSync(membersPath, "utf8"));
  const nameToPath = new Map();
  for (const group of GROUP_ORDER) {
    const dir = path.join(SPECIALTY_ROOT, group.key);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => /\.png$/i.test(x))) {
      const name = f.replace(/\.png$/i, "");
      nameToPath.set(name, `assets/specialty/${group.key}/${f}`);
    }
  }

  let updated = 0;
  for (const m of data.members || []) {
    for (const b of m.specialtyBadges || []) {
      const raw = String(b.name || "")
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
        if (nameToPath.has(base)) {
          const next = nameToPath.get(base);
          if (b.icon !== next) {
            b.icon = next;
            updated++;
          }
          // Also update group if moved
          for (const move of MOVES) {
            if (base === move.name || raw === move.name) {
              b.group = move.to;
              b.category =
                move.to === "water" ? "水上活動組" : "航空活動組";
            }
          }
          break;
        }
      }
    }
  }
  fs.writeFileSync(membersPath, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("member icons updated", updated);
}

(async () => {
  moveBadgeFiles();
  const total = await removeAllBackgrounds();
  mergeSeaAirSyllabus();
  writeGalleryJson();
  updateMemberIcons();
  console.log(`\ndone bg=${total}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
