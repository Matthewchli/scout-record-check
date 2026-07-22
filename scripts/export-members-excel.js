const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const root = path.join(__dirname, "..");
const data = JSON.parse(
  fs.readFileSync(path.join(root, "data", "members.json"), "utf8")
);

const outPath = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  "Desktop",
  "Cursor Scout Record Check.xlsx"
);

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return Object.values(value);
}

function sheetFromRows(rows, headers) {
  const aoa = [headers];
  for (const row of rows) {
    aoa.push(headers.map((h) => (row[h] == null ? "" : row[h])));
  }
  return XLSX.utils.aoa_to_sheet(aoa);
}

const members = data.members || [];

const memberRows = members.map((m) => {
  const act = m.activity || {};
  return {
    姓名: m.name || "",
    ScoutID: m.scoutId || "",
    旅團: m.troop || "",
    小隊: m.section || "",
    職級: m.rank || "",
    入團日期: m.joinDate || "",
    相片路徑: m.photo || "",
    出席率: act.attendanceRate ?? "",
    服務時數: act.serviceHours ?? "",
    露營次數: act.campingCount ?? "",
  };
});

const attendanceRows = [];
const serviceRows = [];
const campingRows = [];
const outdoorRows = [];
const progressiveRows = [];
const progressiveItemRows = [];
const specialtyRows = [];
const awardRows = [];

for (const m of members) {
  const name = m.name || "";
  const id = m.scoutId || "";
  const act = m.activity || {};

  for (const r of asArray(m.attendance)) {
    attendanceRows.push({
      姓名: name,
      ScoutID: id,
      日期: r.date || "",
      活動名稱: r.name || "",
      類型: r.type || "",
      出席狀態: r.status || "",
      備註: r.note || "",
    });
  }

  for (const r of asArray(act.serviceRecords)) {
    serviceRows.push({
      姓名: name,
      ScoutID: id,
      日期: r.date || "",
      活動名稱: r.name || "",
      時數: r.hours ?? "",
      備註: r.note || "",
    });
  }

  for (const r of asArray(act.campingRecords)) {
    campingRows.push({
      姓名: name,
      ScoutID: id,
      日期: r.date || "",
      活動名稱: r.name || "",
      晚數: r.nights ?? "",
      地點備註: r.note || "",
    });
  }

  for (const r of asArray(act.outdoorActivities)) {
    outdoorRows.push({
      姓名: name,
      ScoutID: id,
      日期: r.date || "",
      活動名稱: r.name || "",
      類型: r.type || "",
      備註: r.note || "",
    });
  }

  for (const b of m.progressiveBadges || []) {
    progressiveRows.push({
      姓名: name,
      ScoutID: id,
      獎章代碼: b.key || "",
      獎章名稱: b.name || "",
      狀態: b.status || "",
      完成日期: b.completedDate || "",
      圖示路徑: b.icon || "",
      已完成分項數: (b.completedIds || []).length,
    });

    const dates = b.itemCompletedDates || {};
    for (const itemId of b.completedIds || []) {
      progressiveItemRows.push({
        姓名: name,
        ScoutID: id,
        獎章代碼: b.key || "",
        獎章名稱: b.name || "",
        分項ID: itemId,
        完成日期: dates[itemId] || "",
      });
    }
  }

  for (const b of m.specialtyBadges || []) {
    specialtyRows.push({
      姓名: name,
      ScoutID: id,
      徽章名稱: b.name || "",
      組別代碼: b.group || "",
      組別: b.category || "",
      綱要鍵: b.syllabusKey || "",
      考獲日期: b.earnedDate || "",
      考核日期: b.assessmentDate || "",
      活動名稱: b.activityName || "",
      主辦機構: b.organizer || "",
      主考: b.examiner || "",
      主考職位: b.examinerTitle || "",
      通告標題: b.noticeTitle || "",
      通告路徑: b.noticeUrl || "",
      證書編號: b.certificateNumber || b.certNo || "",
      證書副本: b.certificateCopy || b.certCopy || "",
      圖示路徑: b.icon || "",
    });
  }

  for (const a of m.awards || []) {
    awardRows.push({
      姓名: name,
      ScoutID: id,
      獎項名稱: a.name || "",
      類別: a.category || "",
      考獲日期: a.earnedDate || "",
    });
  }
}

const troopInfoRows = ((data.resources && data.resources.troopInfo) || []).map(
  (r) => ({
    標籤: r.label || "",
    內容: r.value || "",
    提示: r.hint || "",
  })
);

const linkRows = ((data.resources && data.resources.links) || []).map((r) => ({
  標題: r.title || "",
  網址: r.url || "",
  說明: r.desc || "",
}));

const wb = XLSX.utils.book_new();

const sheets = [
  [
    "成員基本資料",
    memberRows,
    [
      "姓名",
      "ScoutID",
      "旅團",
      "小隊",
      "職級",
      "入團日期",
      "相片路徑",
      "出席率",
      "服務時數",
      "露營次數",
    ],
  ],
  [
    "出席紀錄",
    attendanceRows,
    ["姓名", "ScoutID", "日期", "活動名稱", "類型", "出席狀態", "備註"],
  ],
  [
    "服務紀錄",
    serviceRows,
    ["姓名", "ScoutID", "日期", "活動名稱", "時數", "備註"],
  ],
  [
    "露營紀錄",
    campingRows,
    ["姓名", "ScoutID", "日期", "活動名稱", "晚數", "地點備註"],
  ],
  [
    "戶外活動",
    outdoorRows,
    ["姓名", "ScoutID", "日期", "活動名稱", "類型", "備註"],
  ],
  [
    "進度性獎章",
    progressiveRows,
    [
      "姓名",
      "ScoutID",
      "獎章代碼",
      "獎章名稱",
      "狀態",
      "完成日期",
      "圖示路徑",
      "已完成分項數",
    ],
  ],
  [
    "進度性獎章分項",
    progressiveItemRows,
    ["姓名", "ScoutID", "獎章代碼", "獎章名稱", "分項ID", "完成日期"],
  ],
  [
    "專科徽章",
    specialtyRows,
    [
      "姓名",
      "ScoutID",
      "徽章名稱",
      "組別代碼",
      "組別",
      "綱要鍵",
      "考獲日期",
      "考核日期",
      "活動名稱",
      "主辦機構",
      "主考",
      "主考職位",
      "通告標題",
      "通告路徑",
      "證書編號",
      "證書副本",
      "圖示路徑",
    ],
  ],
  ["獎項", awardRows, ["姓名", "ScoutID", "獎項名稱", "類別", "考獲日期"]],
  ["旅團資訊", troopInfoRows, ["標籤", "內容", "提示"]],
  ["資源連結", linkRows, ["標題", "網址", "說明"]],
];

for (const [title, rows, headers] of sheets) {
  const ws = sheetFromRows(rows, headers);
  // Reasonable column widths
  ws["!cols"] = headers.map((h) => ({
    wch: Math.min(
      40,
      Math.max(
        10,
        String(h).length + 2,
        ...rows.slice(0, 50).map((r) => String(r[h] ?? "").length + 1)
      )
    ),
  }));
  XLSX.utils.book_append_sheet(wb, ws, title);
}

XLSX.writeFile(wb, outPath);

console.log("written", outPath);
console.log(
  sheets
    .map(([title, rows]) => `${title}: ${rows.length}`)
    .join("\n")
);
