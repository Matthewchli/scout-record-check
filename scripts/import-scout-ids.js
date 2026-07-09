const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const membersPath = path.join(__dirname, "..", "data", "members.json");
const data = JSON.parse(fs.readFileSync(membersPath, "utf8"));

const DEMO_NAMES = new Set(["陳志明", "林美欣", "黃子軒"]);

const progressiveTemplate = [
  {
    key: "discovery",
    name: "探索獎章",
    icon: "assets/badge-discovery.png",
    status: "not_started",
    completedDate: null,
    completedIds: [],
  },
  {
    key: "standard",
    name: "標準獎章",
    icon: "assets/badge-standard.png",
    status: "not_started",
    completedDate: null,
    completedIds: [],
  },
  {
    key: "advanced",
    name: "高級獎章",
    icon: "assets/badge-advanced.png",
    status: "not_started",
    completedDate: null,
    completedIds: [],
  },
  {
    key: "chief",
    name: "總領袖獎章",
    icon: "assets/badge-chief.png",
    status: "not_started",
    completedDate: null,
    completedIds: [],
  },
];

function emptyMember(name, scoutId, englishName) {
  return {
    name,
    scoutId,
    englishName: englishName || "",
    troop: "新界東第1558旅",
    section: "童軍",
    rank: "隊員",
    joinDate: "",
    photo: null,
    activity: {
      attendanceRate: 0,
      serviceHours: 0,
      campingCount: 0,
      outdoorActivities: [],
    },
    attendance: [],
    progressiveBadges: progressiveTemplate.map((b) => ({
      ...b,
      completedIds: [],
    })),
    specialtyBadges: [],
    awards: [],
  };
}

const demoMembers = data.members.filter((m) => DEMO_NAMES.has(m.name));
if (demoMembers.length !== 3) {
  console.warn(
    "warning: expected 3 demo members, found",
    demoMembers.map((m) => m.name)
  );
}

const wb = XLSX.readFile(
  "c:/Users/heiin/Desktop/童軍管理平台/2025－26 Scou ID Record.xlsx"
);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
  defval: "",
});

const excelMembers = [];
const seen = new Set();

for (const row of rows) {
  const name = String(row.ChineseName || "").trim();
  const scoutId = String(row["Scout ID"] || "").trim();
  const englishName = String(row.EnglishName || "").trim();
  if (!name || !scoutId) continue;
  if (DEMO_NAMES.has(name)) continue;
  const key = `${name}|${scoutId}`;
  if (seen.has(key)) continue;
  seen.add(key);
  excelMembers.push(emptyMember(name, scoutId, englishName));
}

excelMembers.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));

data.members = [...demoMembers, ...excelMembers];

if (data.resources && data.resources.troopInfo) {
  const troop = data.resources.troopInfo.find((i) => i.label === "旅團名稱");
  if (troop) troop.value = "香港童軍總會 新界東第1558旅（林大輝中學）";
}

fs.writeFileSync(membersPath, JSON.stringify(data, null, 2), "utf8");

console.log("demo:", demoMembers.map((m) => `${m.name}/${m.scoutId}`).join(", "));
console.log("excel imported:", excelMembers.length);
console.log("total members:", data.members.length);
console.log(
  "sample empty:",
  JSON.stringify(
    {
      name: excelMembers[0].name,
      scoutId: excelMembers[0].scoutId,
      activity: excelMembers[0].activity,
      specialty: excelMembers[0].specialtyBadges.length,
      awards: excelMembers[0].awards.length,
      progressive: excelMembers[0].progressiveBadges.map(
        (b) => `${b.key}:${b.status}:${b.completedIds.length}`
      ),
    },
    null,
    2
  )
);
