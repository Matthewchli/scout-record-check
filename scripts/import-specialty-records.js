const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const membersPath = path.join(__dirname, "..", "data", "members.json");
const syllabusPath = path.join(__dirname, "..", "data", "specialty-syllabus.json");
const excelPath = "c:/Users/heiin/Desktop/童軍管理平台/專科徽章 Record.xlsx";

const DEMO_IDS = new Set(["2025000101", "2025000102", "2025000103"]);

const GROUP_MAP = {
  興趣組: { key: "interest", label: "興趣組" },
  技能組: { key: "skill", label: "技能組" },
  服務組: { key: "service", label: "服務組" },
  教導組: { key: "instructor", label: "教導組" },
  其他獎章: { key: "other", label: "其他獎章及徽章" },
  其他獎章及徽章: { key: "other", label: "其他獎章及徽章" },
};

const NAME_ALIASES = {
  梁諾言: "梁諾然",
  楊淳𤋮: "楊淳熙",
};

function excelSerialToIso(value) {
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return null;
  }
  if (typeof value !== "number") return null;
  const d = XLSX.SSF.parse_date_code(value);
  if (!d) return null;
  return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
}

function parseActivityName(raw) {
  const text = String(raw || "").trim();
  const m = text.match(/^(.+?)\s*[-－—]\s*(.+)$/);
  if (!m) return null;
  const groupLabel = m[1].trim();
  const badgeName = m[2].trim();
  const group = GROUP_MAP[groupLabel];
  if (!group) return null;
  return { groupLabel: group.label, groupKey: group.key, badgeName };
}

function baseNameOf(badgeName, groupKey) {
  if (groupKey === "other") return badgeName;
  return badgeName.replace(/章$/, "").replace(/獎章$/, "");
}

function resolveSyllabusKey(syllabus, groupKey, badgeName) {
  const base = baseNameOf(badgeName, groupKey);
  const candidates =
    groupKey === "other"
      ? [badgeName, base, `${base}章`, `${base}獎章`]
      : [base, badgeName.replace(/章$/, ""), badgeName];
  for (const c of candidates) {
    const key = `${groupKey}:${c}`;
    if (syllabus[key]) return key;
  }
  return `${groupKey}:${base}`;
}

function iconPath(groupKey, badgeName, syllabusKey, syllabus) {
  const info = syllabus[syllabusKey];
  const bases = [];
  if (info) bases.push(info.name);
  bases.push(baseNameOf(badgeName, groupKey), badgeName);
  for (const b of bases) {
    const rel = `assets/specialty/${groupKey}/${b}.png`;
    if (fs.existsSync(path.join(__dirname, "..", rel))) return rel;
  }
  return `assets/specialty/${groupKey}/${baseNameOf(badgeName, groupKey)}.png`;
}

function main() {
  const syllabus = JSON.parse(fs.readFileSync(syllabusPath, "utf8")).badges;
  const data = JSON.parse(fs.readFileSync(membersPath, "utf8"));

  const byName = new Map();
  for (const m of data.members) {
    if (DEMO_IDS.has(m.scoutId)) continue;
    byName.set(m.name, m);
  }

  const wb = XLSX.readFile(excelPath);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    defval: "",
    raw: true,
  });

  /** name -> badge[] */
  const earned = new Map();
  const unmatchedPeople = new Map();
  const unmatchedActs = new Set();
  const noSyllabus = new Set();
  let skippedFail = 0;

  for (const row of rows) {
    const rawName = String(row["姓名"] || "").trim();
    const result = String(row["成績/參與情況"] || "").trim();
    if (!rawName) continue;
    if (result && result !== "合格") {
      skippedFail += 1;
      continue;
    }

    const parsed = parseActivityName(row["活動名稱"]);
    if (!parsed) {
      unmatchedActs.add(String(row["活動名稱"] || "").trim());
      continue;
    }

    const name = NAME_ALIASES[rawName] || rawName;
    const member = byName.get(name);
    if (!member) {
      unmatchedPeople.set(rawName, (unmatchedPeople.get(rawName) || 0) + 1);
      continue;
    }

    const date = excelSerialToIso(row["舉辦日期"]);
    const syllabusKey = resolveSyllabusKey(
      syllabus,
      parsed.groupKey,
      parsed.badgeName
    );
    if (!syllabus[syllabusKey]) noSyllabus.add(syllabusKey);

    const displayName =
      parsed.groupKey === "instructor"
        ? `${baseNameOf(parsed.badgeName, parsed.groupKey)}章（教導組）`
        : parsed.badgeName;

    const badge = {
      name: displayName,
      earnedDate: date,
      category: parsed.groupLabel,
      group: parsed.groupKey,
      icon: iconPath(parsed.groupKey, parsed.badgeName, syllabusKey, syllabus),
      activityName: String(row["活動名稱"] || "").trim(),
      organizer: String(row["舉辦機構"] || "").trim(),
      assessmentDate: date,
      syllabusKey,
      examiner: "",
    };

    if (!earned.has(name)) earned.set(name, []);
    // dedupe same syllabusKey+date
    const list = earned.get(name);
    if (
      !list.some(
        (b) => b.syllabusKey === badge.syllabusKey && b.assessmentDate === badge.assessmentDate
      )
    ) {
      list.push(badge);
    }
  }

  // Apply: replace specialty badges for members present in Excel;
  // clear specialty for other real members (source of truth = Excel)
  let updated = 0;
  let cleared = 0;
  for (const member of data.members) {
    if (DEMO_IDS.has(member.scoutId)) continue;
    if (earned.has(member.name)) {
      member.specialtyBadges = earned
        .get(member.name)
        .sort((a, b) => String(b.assessmentDate || "").localeCompare(String(a.assessmentDate || "")));
      updated += 1;
    } else {
      if ((member.specialtyBadges || []).length) cleared += 1;
      member.specialtyBadges = [];
    }
  }

  fs.writeFileSync(membersPath, JSON.stringify(data, null, 2) + "\n", "utf8");

  console.log("excel rows", rows.length);
  console.log("members updated", updated);
  console.log("members cleared", cleared);
  console.log("skipped non-pass", skippedFail);
  if (unmatchedPeople.size) {
    console.log("unmatched people:");
    for (const [n, c] of unmatchedPeople) console.log(`  ${n} (${c})`);
  }
  if (unmatchedActs.size) console.log("unmatched acts", [...unmatchedActs]);
  if (noSyllabus.size) console.log("no syllabus keys", [...noSyllabus]);

  for (const [name, badges] of [...earned.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "zh-Hant")
  )) {
    console.log(
      `${name}: ${badges.length} — ${badges.map((b) => b.name).join("、")}`
    );
  }
}

main();
