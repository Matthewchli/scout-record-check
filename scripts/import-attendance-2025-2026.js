const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const membersPath = path.join(__dirname, "..", "data", "members.json");
const activitiesPath = path.join(__dirname, "..", "data", "activities.json");
const attDir =
  "c:/Users/heiin/Desktop/童軍管理平台/出席記錄/2025-2026 出席記錄";
const excelPath = "c:/Users/heiin/Desktop/童軍管理平台/活動記錄.xlsx";

const DEMO_IDS = new Set(["2025000101", "2025000102", "2025000103"]);
const YEAR_START = "2025-09-01";
const YEAR_END = "2026-08-31";
/** Cancelled activities — do not import */
const SKIP_DATES = new Set(["2026-06-26"]);

const SKIP_NAMES = new Set([
  "出席情況",
  "總成員出席人數",
  "備注",
  "備註",
]);

const NAME_ALIASES = {
  楊淳𤋮: "楊淳熙",
};

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

function ensureActivityInExcel() {
  if (!fs.existsSync(excelPath)) {
    console.warn("skip excel update: file not found");
    return;
  }
  const wb = XLSX.readFile(excelPath);
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });

  const has = rows.some((r) => {
    const v = r["日期"];
    if (typeof v === "number") {
      const d = XLSX.SSF.parse_date_code(v);
      if (!d) return false;
      const iso = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
      return iso === "2025-11-01";
    }
    return String(v).includes("2025-11-01") || String(v).includes("2025/11/01");
  });
  if (has) {
    console.log("excel already has 2025-11-01");
    return;
  }

  // Excel serial for 2025-11-01
  const serial = Math.round(
    (Date.UTC(2025, 10, 1) - Date.UTC(1899, 11, 30)) / 86400000
  );
  rows.push({
    日期: serial,
    "活動／集會": "恆常集會",
    類型: "集會",
    服務時數: "",
    露營晚數: "",
    活動地點: "",
  });
  const newSheet = XLSX.utils.json_to_sheet(rows);
  wb.Sheets[sheetName] = newSheet;
  XLSX.writeFile(wb, excelPath);
  console.log("excel: added 2025-11-01 恆常集會");
}

function main() {
  ensureActivityInExcel();

  const activities = JSON.parse(
    fs.readFileSync(activitiesPath, "utf8")
  ).activities;
  const actByDate = new Map(
    activities
      .filter((a) => a.year === "2025-2026")
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
      skipped.push({ date, file, reason: "活動取消" });
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

  // Demo accounts: ensure 2025-11-01 恆常集會 exists in attendance
  const newAct = actByDate.get("2025-11-01");
  if (newAct) {
    for (const member of data.members) {
      if (!DEMO_IDS.has(member.scoutId)) continue;
      member.attendance = member.attendance || [];
      if (!member.attendance.some((r) => r.date === "2025-11-01")) {
        member.attendance.push({
          date: "2025-11-01",
          name: newAct.name,
          type: newAct.type,
          status: "present",
          note: "",
        });
        member.attendance.sort((a, b) => b.date.localeCompare(a.date));
        const present = member.attendance.filter((r) => r.status === "present").length;
        const total = member.attendance.length;
        member.activity = member.activity || {};
        member.activity.attendanceRate = total
          ? Math.round((present / total) * 100)
          : 0;
      }
    }
  }

  fs.writeFileSync(membersPath, JSON.stringify(data, null, 2) + "\n", "utf8");

  console.log("files", files.length);
  console.log("skipped", skipped);
  console.log("missing activity dates", missingActivityDates);
  console.log("real members updated", updated);
  console.log(
    "members with 2025-2026 records",
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
    console.log("unmatched names:");
    for (const [n, c] of [...unmatched.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${n} (${c})`);
    }
  } else {
    console.log("all attendance names matched");
  }

  // verify activity names used for known diffs
  const nameCheck = new Set();
  for (const recs of memberAtt.values()) {
    for (const r of recs) {
      if (
        [
          "2025-09-29",
          "2025-10-25",
          "2025-10-26",
          "2025-11-01",
          "2025-11-08",
          "2026-02-28",
          "2026-05-16",
          "2026-07-03",
        ].includes(r.date)
      ) {
        nameCheck.add(`${r.date} ${r.name} ${r.type}`);
      }
    }
  }
  console.log("name check:\n" + [...nameCheck].sort().join("\n"));
}

main();
