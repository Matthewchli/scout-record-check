const fs = require("fs");
const path = require("path");

const membersPath = path.join(__dirname, "..", "data", "members.json");
const syllabus = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "specialty-syllabus.json"), "utf8")
).badges;

const GROUP_LABEL = {
  interest: "興趣組",
  skill: "技能組",
  service: "服務組",
  instructor: "教導組",
  other: "其他獎章及徽章",
};

const ORGANIZERS = [
  "新界東第1558旅童軍團",
  "新界東地域專章秘書",
  "香港童軍總會",
  "香港紅十字會",
  "香港聖約翰救護機構",
];
const EXAMINERS = ["李領袖", "王領袖", "張領袖", "陳主考", "黃主考", "林主考"];

function pick(arr, i) {
  return arr[i % arr.length];
}

function iconPath(group, baseName) {
  const p = path.join(__dirname, "..", "assets", "specialty", group, `${baseName}.png`);
  return fs.existsSync(p) ? `assets/specialty/${group}/${baseName}.png` : null;
}

function displayName(info) {
  const base = info.name;
  if (info.group === "instructor") return `${base}章（教導組）`;
  if (info.group === "other") {
    if (/章$|圈$|計劃$/.test(base)) return base;
    return `${base}章`;
  }
  return `${base}章`;
}

function makeBadge(syllabusKey, assessmentDate, extras = {}) {
  const info = syllabus[syllabusKey];
  if (!info) throw new Error(`missing syllabus ${syllabusKey}`);
  const name = displayName(info);
  const icon =
    iconPath(info.group, info.name) ||
    `assets/specialty/${info.group}/${info.name}.png`;
  return {
    name,
    earnedDate: assessmentDate,
    category: GROUP_LABEL[info.group] || info.category,
    group: info.group,
    icon,
    activityName: extras.activityName || `${name.replace(/（教導組）/, "")}考核`,
    organizer: extras.organizer || ORGANIZERS[0],
    assessmentDate,
    syllabusKey,
    examiner: extras.examiner || EXAMINERS[0],
  };
}

const profiles = {
  // 盧羿衡：較多章，涵蓋五組
  HK24001: [
    ["interest:游泳", "2025-07-22"],
    ["interest:營地烹飪", "2025-03-15"],
    ["interest:單車", "2024-11-02"],
    ["interest:攝影", "2024-05-18"],
    ["interest:自然", "2023-12-09"],
    ["skill:露營", "2024-08-10"],
    ["skill:地圖閱讀", "2024-04-20"],
    ["skill:先鋒工程", "2025-01-11"],
    ["skill:觀察", "2025-10-05"],
    ["service:急救", "2024-01-20"],
    ["service:公民", "2025-05-17"],
    ["service:消防", "2023-09-30"],
    ["instructor:露營", "2025-11-08"],
    ["instructor:游泳", "2026-02-14"],
    ["other:服務獎章", "2025-06-30"],
    ["other:領導才獎章", "2026-03-22"],
  ],
  // 吳溢潼：中等數量，偏興趣／服務
  HK24015: [
    ["interest:藝術", "2025-09-05"],
    ["interest:氣象", "2025-04-12"],
    ["interest:愛護動物", "2024-10-19"],
    ["interest:圖書管理", "2024-06-08"],
    ["skill:觀察", "2025-01-25"],
    ["skill:烹飪（中式）", "2024-12-14"],
    ["skill:天象", "2025-08-16"],
    ["service:急救", "2025-02-14"],
    ["service:語言", "2024-09-07"],
    ["service:共融", "2025-11-29"],
    ["instructor:攝影", "2026-01-10"],
    ["other:世界童軍環境章", "2026-04-05"],
    ["other:社區參與章", "2025-07-03"],
  ],
  // 吳承軒：較新成員，仍展示多組
  HK25008: [
    ["interest:釣魚", "2026-01-25"],
    ["interest:運動", "2025-11-15"],
    ["interest:步操", "2025-08-23"],
    ["interest:划艇", "2025-05-31"],
    ["skill:電腦", "2025-12-06"],
    ["skill:通訊", "2025-09-20"],
    ["skill:探險", "2026-02-28"],
    ["service:秘書", "2025-10-11"],
    ["service:物資管理", "2026-03-14"],
    ["other:維護自然世界章", "2026-04-18"],
  ],
};

const data = JSON.parse(fs.readFileSync(membersPath, "utf8"));

for (const member of data.members) {
  const list = profiles[member.scoutId];
  if (!list) continue;
  member.specialtyBadges = list.map(([key, date], i) => {
    const badge = makeBadge(key, date, {
      organizer: pick(ORGANIZERS, i),
      examiner: pick(EXAMINERS, i + 1),
    });
    if (!fs.existsSync(path.join(__dirname, "..", badge.icon))) {
      console.warn("missing icon", badge.icon, key);
    }
    if (!syllabus[key]) console.warn("missing syllabus", key);
    return badge;
  });
  console.log(
    member.name,
    member.specialtyBadges.length,
    member.specialtyBadges.map((b) => b.name).join("、")
  );
}

fs.writeFileSync(membersPath, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log("updated demo specialty badges");
