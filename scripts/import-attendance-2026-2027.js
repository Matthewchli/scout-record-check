const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const membersPath = path.join(__dirname, "..", "data", "members.json");
const activitiesPath = path.join(__dirname, "..", "data", "activities.json");
const attDir =
  "c:/Users/heiin/Desktop/童軍管理平台/出席記錄/2026-2027 出席記錄";

const DEMO_IDS = new Set(["2025000101", "2025000102", "2025000103"]);
const YEAR_START = "2026-09-01";
const YEAR_END = "2027-08-31";
const SKIP_DATES = new Set();

const SKIP_NAMES = new Set([
  "出席情況",
  "總成員出席人數",
  "備注",
  "備註",
  "新成員",
  "新成員出席人數",
  "舊成員出席人數",
]);

const NAME_ALIASES = {
  楊淳𤋮: "楊淳熙",
  吳子琳: "吴子琳",
};

/** Dates that have Excel files: members eligible that day but missing from the sheet are marked absent. */
const FILL_ABSENT_DATES = new Set(["2026-10-31", "2026-11-01"]);

function isPatrolHeader(name) {
  return /小隊/.test(name);
}

function excelDateFromFilename(filename) {
  const m = filename.match(/^(\d{8})\s+/);
  if (!m) return null;
  const d = m[1];
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

function normalizeStatus(raw) {
  const s = String(raw || "").trim();
  if (s === "出席") return "present";
  if (s === "缺席") return "absent";
  return null;
}

function normalizeNote(raw) {
  const n = String(raw || "").trim();
  if (!n || /^\d+$/.test(n) || n === "備注" || n === "備註") return "";
  return n;
}

function resolveMemberName(name, byName) {
  const n = NAME_ALIASES[name] || name;
  if (byName.has(n)) return n;
  const nfc = n.normalize("NFC");
  if (byName.has(nfc)) return nfc;
  return null;
}

function memberEligibleOnDate(member, date) {
  if (!date) return true;
  if (member.joinDate && member.joinDate > date) return false;
  if (member.leftDate && member.leftDate <= date) return false;
  if (member.leaderFrom && member.leaderFrom <= date) return false;
  return true;
}

function parseAttendanceFile(filePath, filename) {
  const date = excelDateFromFilename(filename);
  if (!date) return { date: null, records: [], error: "bad filename" };

  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames.find((s) => s !== "程式") || wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    defval: "",
    header: 1,
    raw: false,
  });

  const records = [];
  for (const row of rows) {
    const name = String(row[0] || "").trim();
    if (!name || SKIP_NAMES.has(name) || isPatrolHeader(name)) continue;
    if (/出席記錄/.test(name) || /出席紀錄/.test(name)) continue;

    const status = normalizeStatus(row[1]);
    if (!status) continue;

    records.push({
      name,
      status,
      note: normalizeNote(row[2]),
    });
  }

  return { date, records };
}

function main() {
  const activities = JSON.parse(fs.readFileSync(activitiesPath, "utf8")).activities;
  const actByDate = new Map(
    activities
      .filter((a) => a.year === "2026-2027")
      .map((a) => [a.date, a])
  );

  const data = JSON.parse(fs.readFileSync(membersPath, "utf8"));
  const byName = new Map();
  for (const m of data.members) {
    if (DEMO_IDS.has(m.scoutId)) continue;
    byName.set(m.name, m);
  }

  const files = fs
    .readdirSync(attDir)
    .filter((f) => f.endsWith(".xlsx"))
    .sort();

  const memberAtt = new Map();
  const unmatched = new Map();
  const skippedIneligible = [];
  const skipped = [];
  const missingActivityDates = [];

  for (const file of files) {
    const { date, records, error } = parseAttendanceFile(
      path.join(attDir, file),
      file
    );
    if (error || !date) {
      console.warn("skip", file, error);
      continue;
    }
    if (SKIP_DATES.has(date)) {
      skipped.push({ date, file, reason: "無點名檔／略過" });
      continue;
    }

    const act = actByDate.get(date);
    if (!act) {
      missingActivityDates.push({ date, file });
      continue;
    }

    for (const r of records) {
      const resolved = resolveMemberName(r.name, byName);
      if (!resolved) {
        unmatched.set(r.name, (unmatched.get(r.name) || 0) + 1);
        continue;
      }
      const member = byName.get(resolved);
      if (!memberEligibleOnDate(member, date)) {
        skippedIneligible.push(`${date} ${resolved} ${r.status}`);
        continue;
      }
      if (!memberAtt.has(resolved)) memberAtt.set(resolved, []);
      memberAtt.get(resolved).push({
        date,
        name: act.name,
        type: act.type,
        status: r.status,
        note: r.note,
      });
    }
  }

  let filledAbsent = 0;
  for (const date of [...FILL_ABSENT_DATES].sort()) {
    const act = actByDate.get(date);
    if (!act) continue;
    for (const member of data.members) {
      if (DEMO_IDS.has(member.scoutId)) continue;
      if (!memberEligibleOnDate(member, date)) continue;
      const recs = memberAtt.get(member.name) || [];
      if (recs.some((r) => r.date === date)) continue;
      if (!memberAtt.has(member.name)) memberAtt.set(member.name, []);
      memberAtt.get(member.name).push({
        date,
        name: act.name,
        type: act.type,
        status: "absent",
        note: "",
      });
      filledAbsent += 1;
      console.log("fill absent", date, member.name);
    }
  }

  let updated = 0;
  for (const member of data.members) {
    if (DEMO_IDS.has(member.scoutId)) continue;
    const yearRecords = (memberAtt.get(member.name) || []).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
    const other = (member.attendance || []).filter(
      (r) => r.date < YEAR_START || r.date > YEAR_END
    );
    member.attendance = [...other, ...yearRecords].sort((a, b) =>
      b.date.localeCompare(a.date)
    );

    const present = member.attendance.filter((r) => r.status === "present").length;
    const total = member.attendance.length;
    member.activity = member.activity || {};
    member.activity.attendanceRate = total
      ? Math.round((present / total) * 100)
      : 0;
    updated += 1;
  }

  fs.writeFileSync(membersPath, JSON.stringify(data, null, 2) + "\n", "utf8");

  console.log("files", files.length);
  console.log("skipped dates", skipped);
  console.log("missing activity dates", missingActivityDates);
  console.log("real members updated", updated);
  console.log("filled absent", filledAbsent);
  console.log(
    "members with 2026-2027 records",
    [...memberAtt.entries()].filter(([, v]) => v.length).length
  );
  const counts = [...memberAtt.values()].map((v) => v.length);
  if (counts.length) {
    console.log(
      "records per member min/max",
      Math.min(...counts),
      Math.max(...counts)
    );
  }
  if (unmatched.size) {
    console.log("unmatched names (skipped):");
    for (const [n, c] of [...unmatched.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${n} (${c})`);
    }
  } else {
    console.log("all attendance names matched");
  }
  console.log("skipped ineligible", skippedIneligible.length);
}

main();
