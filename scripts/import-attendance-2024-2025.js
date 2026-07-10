const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const membersPath = path.join(__dirname, "..", "data", "members.json");
const activitiesPath = path.join(__dirname, "..", "data", "activities.json");
const attDir =
  "c:/Users/heiin/Desktop/童軍管理平台/出席記錄/2024-2025 出席記錄";

const DEMO_IDS = new Set(["2025000101", "2025000102", "2025000103"]);
const YEAR_START = "2024-09-01";
const YEAR_END = "2025-08-31";

const SKIP_NAMES = new Set([
  "出席情況",
  "總成員出席人數",
  "備注",
  "備註",
]);

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

/** Common OCR / variant fixes */
const NAME_ALIASES = {
  楊淳𤋮: "楊淳熙",
};

function resolveMemberName(name, byName) {
  const n = NAME_ALIASES[name] || name;
  if (byName.has(n)) return n;
  // try NFC normalize
  const nfc = n.normalize("NFC");
  if (byName.has(nfc)) return nfc;
  return null;
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
    if (/出席記錄/.test(name)) continue;

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
    activities.filter((a) => a.year === "2024-2025").map((a) => [a.date, a])
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

  /** name -> attendance[] for 2024-2025 */
  const memberAtt = new Map();
  const unmatched = new Map(); // name -> count
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

  let updated = 0;
  for (const member of data.members) {
    if (DEMO_IDS.has(member.scoutId)) continue;
    const yearRecords = memberAtt.get(member.name) || [];
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
  console.log("real members updated", updated);
  console.log(
    "members with 2024-2025 records",
    [...memberAtt.entries()].filter(([, v]) => v.length).length
  );
  console.log(
    "sample",
    [...memberAtt.entries()]
      .slice(0, 3)
      .map(([n, v]) => `${n}:${v.length}`)
      .join(", ")
  );
  if (missingActivityDates.length) {
    console.log("missing activity dates", missingActivityDates);
  }
  if (unmatched.size) {
    console.log("unmatched names:");
    for (const [n, c] of [...unmatched.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${n} (${c})`);
    }
  } else {
    console.log("all attendance names matched");
  }

  // rate summary
  const rates = data.members
    .filter((m) => !DEMO_IDS.has(m.scoutId))
    .map((m) => ({
      n: m.name,
      att: (m.attendance || []).length,
      rate: m.activity.attendanceRate,
    }))
    .sort((a, b) => b.att - a.att);
  console.log("top attendance counts", rates.slice(0, 5));
  console.log("zero attendance", rates.filter((r) => r.att === 0).map((r) => r.n));
}

main();
