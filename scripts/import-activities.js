const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const excelPath = "c:\\Users\\heiin\\Desktop\\童軍管理平台\\活動記錄.xlsx";
const membersPath = path.join(__dirname, "..", "data", "members.json");

function excelSerialToIso(value) {
  if (typeof value === "string") {
    if (/年度/.test(value)) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return null;
  }
  if (typeof value !== "number") return null;
  const d = XLSX.SSF.parse_date_code(value);
  if (!d) return null;
  return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
}

function scoutYearOf(isoDate) {
  const [y, m] = isoDate.split("-").map(Number);
  const startYear = m >= 9 ? y : y - 1;
  return `${startYear}-${startYear + 1}`;
}

/** Excel 日期覆寫：key = 原日期|活動名稱 */
const DATE_OVERRIDES = {
  "2025-07-03|學校時裝表演": "2026-07-03",
};

function parseActivities() {
  const wb = XLSX.readFile(excelPath);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    defval: "",
    raw: true,
  });

  const activities = [];
  const seen = new Set();

  for (const row of rows) {
    let date = excelSerialToIso(row["日期"]);
    const name = String(row["活動／集會"] || "").trim();
    if (!date || !name) continue;
    const override = DATE_OVERRIDES[`${date}|${name}`];
    if (override) date = override;

    let type = String(row["類型"] || "").trim();
    const hours = row["服務時數"] === "" ? null : Number(row["服務時數"]);
    const nights = row["露營晚數"] === "" ? null : Number(row["露營晚數"]);
    const location = String(row["活動地點"] || "").trim();

    if (!type && nights != null && !Number.isNaN(nights)) type = "露營";
    if (!type && hours != null && !Number.isNaN(hours)) type = "服務";
    if (!type) type = "集會";

    const key = `${date}|${name}|${type}`;
    if (seen.has(key)) continue;
    seen.add(key);

    activities.push({
      date,
      name,
      type,
      hours: hours != null && !Number.isNaN(hours) ? hours : null,
      nights: nights != null && !Number.isNaN(nights) ? nights : null,
      location,
      year: scoutYearOf(date),
    });
  }

  return activities.sort((a, b) => b.date.localeCompare(a.date));
}

function buildServiceRecords(activities) {
  return activities
    .filter((a) => a.type === "服務")
    .map((a) => ({
      date: a.date,
      name: a.name,
      hours: a.hours || 0,
      note: a.location || "",
    }));
}

function buildCampingRecords(activities) {
  return activities
    .filter((a) => a.type === "露營")
    .map((a) => ({
      date: a.date,
      name: a.name,
      nights: a.nights != null ? a.nights : 1,
      note: a.location || "",
    }));
}

function buildOutdoorActivities(activities) {
  return activities
    .filter((a) => a.type === "戶外")
    .map((a) => ({
      date: a.date,
      name: a.name,
      type: a.type,
      note: a.location || "",
    }));
}

function buildAttendance(activities, profile) {
  // profile: { absentDates: Set, lateDates: Set, excusedDates: Set }
  return activities.map((a) => {
    let status = "present";
    let note = "";
    if (profile.absentDates.has(a.date)) {
      status = "absent";
    } else if (profile.excusedDates.has(a.date)) {
      status = "absent";
      note = "請假";
    } else if (profile.lateDates.has(a.date)) {
      status = "present";
      note = "遲到";
    }
    return {
      date: a.date,
      name: a.name,
      type: a.type,
      status,
      note,
    };
  });
}

function applyActivityBundle(member, activities, attendanceProfile) {
  const serviceRecords = buildServiceRecords(activities);
  const campingRecords = buildCampingRecords(activities);
  const outdoorActivities = buildOutdoorActivities(activities);

  member.attendance = buildAttendance(activities, attendanceProfile);
  member.activity = {
    ...(member.activity || {}),
    attendanceRate: 0,
    serviceHours: serviceRecords.reduce((s, r) => s + (Number(r.hours) || 0), 0),
    campingCount: campingRecords.length,
    outdoorActivities,
    serviceRecords,
    campingRecords,
  };

  const present = member.attendance.filter((r) => r.status === "present").length;
  const total = member.attendance.length;
  member.activity.attendanceRate = total
    ? Math.round((present / total) * 100)
    : 0;
}

const activities = parseActivities();
console.log("parsed activities", activities.length);
console.log(
  "by type",
  activities.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {})
);
console.log(
  "by year",
  activities.reduce((acc, a) => {
    acc[a.year] = (acc[a.year] || 0) + 1;
    return acc;
  }, {})
);

const data = JSON.parse(fs.readFileSync(membersPath, "utf8"));

const demoProfiles = {
  HK24001: {
    absentDates: new Set(["2025-03-22", "2025-05-24", "2024-10-19", "2025-03-15"]),
    lateDates: new Set(["2026-04-26", "2025-04-26"]),
    excusedDates: new Set(["2026-03-22"]),
  },
  HK24015: {
    absentDates: new Set(["2025-05-31", "2024-10-19", "2026-02-28"]),
    lateDates: new Set(["2025-11-23"]),
    excusedDates: new Set(["2025-03-15"]),
  },
  HK25008: {
    absentDates: new Set(["2024-12-14", "2026-01-31"]),
    lateDates: new Set([]),
    excusedDates: new Set([]),
  },
};

const emptyProfile = {
  absentDates: new Set(),
  lateDates: new Set(),
  excusedDates: new Set(),
};

for (const member of data.members) {
  if (demoProfiles[member.scoutId]) {
    applyActivityBundle(member, activities, demoProfiles[member.scoutId]);
    console.log(
      "demo",
      member.name,
      "att",
      member.attendance.length,
      "service",
      member.activity.serviceHours,
      "camp",
      member.activity.campingCount,
      "outdoor",
      member.activity.outdoorActivities.length,
      "rate",
      member.activity.attendanceRate
    );
  } else {
    // 真實帳號：保留空白出席，但同步活動目錄結構欄位
    member.activity = {
      ...(member.activity || {}),
      attendanceRate: 0,
      serviceHours: 0,
      campingCount: 0,
      outdoorActivities: [],
      serviceRecords: [],
      campingRecords: [],
    };
    member.attendance = member.attendance || [];
  }
}

// 另存旅團活動總表，供日後查閱／匯入
const catalogPath = path.join(__dirname, "..", "data", "activities.json");
fs.writeFileSync(
  catalogPath,
  JSON.stringify(
    {
      source: "活動記錄.xlsx",
      yearRule: "每年 9 月 1 日至翌年 8 月 31 日",
      activities,
    },
    null,
    2
  ) + "\n",
  "utf8"
);

fs.writeFileSync(membersPath, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log("wrote", catalogPath);
console.log("updated members.json");
