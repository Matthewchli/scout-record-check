const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const text = fs.readFileSync(path.join(ROOT, "tmp", "pdf-full.txt"), "utf8");

function unspaceChinese(s) {
  return String(s || "")
    .replace(/[ \t\u00a0]+/g, "")
    .replace(/\n+/g, "")
    .trim();
}

/** Parse TOC lines: Chinese (possibly spaced) + English + page number */
function parseTocBadgeLines(block) {
  const lines = block.split(/\n/).map((l) => l.replace(/\t/g, " ").trim());
  const items = [];
  for (const line of lines) {
    if (!line) continue;
    if (/^童軍專科徽章|^SCOUT PROFICIENCY|^海上活動|^航空活動|^其他獎章|^OTHER |^THE |^SEA |^AIR |^INSTRUCTOR|^教導組|^目\s*$|^錄\s*$|^-- /.test(line)) {
      continue;
    }
    // e.g. 釣  魚  Angler  48  OR  烹 飪（中 式）  Cook (Chinese Dishes)  90
    const m = line.match(
      /^(.+?)\s+([A-Za-z][A-Za-z0-9 &'()\-\/’',.]*)\s+(\d+)\s*$/
    );
    if (!m) continue;
    const name = unspaceChinese(m[1])
      .replace(/（/g, "（")
      .replace(/）/g, "）")
      .replace(/烹飪\(中式\)/g, "烹飪（中式）")
      .replace(/烹飪（中式）/g, "烹飪（中式）");
    // normalize 烹飪(中式) variants from TOC "烹 飪（中 式）"
    let normalized = name;
    if (/烹飪.*中式/.test(name)) normalized = "烹飪（中式）";
    if (normalized.length > 20 || normalized.length < 1) continue;
    if (/目錄|引言|支部|進度|附錄|制服/.test(normalized)) continue;
    items.push({ name: normalized, english: m[2].trim(), page: Number(m[3]) });
  }
  return items;
}

const tocStart = text.indexOf("童軍專科徽章（興趣組）");
const tocEnd = text.indexOf("附錄", tocStart);
const toc = text.slice(tocStart, tocEnd > 0 ? tocEnd : tocStart + 6000);

function section(label, nextLabel) {
  const a = toc.indexOf(label);
  if (a < 0) return "";
  const b = nextLabel ? toc.indexOf(nextLabel, a + 1) : toc.length;
  return toc.slice(a, b > 0 ? b : toc.length);
}

const interest = parseTocBadgeLines(
  section("童軍專科徽章（興趣組）", "童軍專科徽章（技能組）")
);
const skill = parseTocBadgeLines(
  section("童軍專科徽章（技能組）", "童軍專科徽章（服務組）")
);
const service = parseTocBadgeLines(
  section("童軍專科徽章（服務組）", "童軍專科徽章（教導組）")
);
const water = parseTocBadgeLines(
  section("海上活動徽章", "航空活動")
).filter((x) => ["艇工", "水手", "水手長"].includes(x.name));
const aviation = parseTocBadgeLines(
  section("航空活動徽章", "其他獎章及徽章")
).filter((x) =>
  ["初級航空活動", "中級航空活動", "高級航空活動"].includes(x.name)
);
const other = parseTocBadgeLines(
  section("其他獎章及徽章", null)
);

// Instructor list from syllabus body (3-column layout, column-first as printed)
const instructor = [
  "單車",
  "攝影",
  "風帆",
  "游泳",
  "天象",
  "原野烹飪",
  "露營",
  "通訊",
  "烹飪（中式）",
  "地圖繪製",
  "機械",
  "氣象",
  "觀察",
  "野外定向",
  "先鋒工程",
  "樹木護理",
  "護養",
  "拯溺",
].map((name, i) => ({ name, english: "", page: 137, order: i }));

// Water TOC may miss if English parse failed — force syllabus order
const waterForced = [
  { name: "艇工", english: "Oarsman", page: 141 },
  { name: "水手", english: "Boatman", page: 142 },
  { name: "水手長", english: "Boatswain", page: 143 },
];
const aviationForced = [
  { name: "初級航空活動", english: "Basic Air Activity", page: 147 },
  { name: "中級航空活動", english: "Intermediate Air Activity", page: 149 },
  { name: "高級航空活動", english: "Advanced Air Activity", page: 151 },
];

const order = {
  source: "FullVersion-zh.pdf table of contents + instructor list p.137",
  groups: {
    interest: interest.map((x) => x.name),
    skill: skill.map((x) => x.name),
    service: service.map((x) => x.name),
    instructor: instructor.map((x) => x.name),
    water: (water.length === 3 ? water : waterForced).map((x) => x.name),
    aviation: (aviation.length === 3 ? aviation : aviationForced).map(
      (x) => x.name
    ),
    other: other.map((x) => x.name),
  },
};

const outPath = path.join(ROOT, "data", "specialty-order.json");
fs.writeFileSync(outPath, JSON.stringify(order, null, 2) + "\n", "utf8");

for (const [k, names] of Object.entries(order.groups)) {
  console.log(k, names.length, names.join("、"));
}
