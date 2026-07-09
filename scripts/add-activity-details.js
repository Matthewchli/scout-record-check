const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "data", "members.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));

const demos = {
  HK24001: {
    serviceRecords: [
      { date: "2026-04-05", name: "清明植樹服務", hours: 4, note: "" },
      { date: "2026-01-18", name: "社區清潔服務", hours: 3, note: "" },
      { date: "2025-12-20", name: "聖誕老人派禮物", hours: 5, note: "" },
      { date: "2025-11-02", name: "賣旗日", hours: 6, note: "" },
      { date: "2025-10-12", name: "長者中心探訪", hours: 3, note: "" },
      { date: "2025-09-14", name: "校園清潔服務", hours: 2, note: "" },
      { date: "2025-08-23", name: "暑期社區服務日", hours: 8, note: "" },
      { date: "2025-07-19", name: "義工訓練暨服務", hours: 6, note: "" },
      { date: "2025-06-08", name: "環保回收服務", hours: 4, note: "" },
      { date: "2025-05-11", name: "母親節探訪服務", hours: 3, note: "" },
      { date: "2025-04-06", name: "清明植樹服務", hours: 4, note: "" },
    ],
    campingRecords: [
      { date: "2026-05-16", name: "長洲露營", nights: 2, note: "" },
      { date: "2026-02-21", name: "船灣郊野公園露營", nights: 1, note: "" },
      { date: "2025-12-06", name: "西貢露營", nights: 2, note: "" },
      { date: "2025-10-18", name: "大嶼山露營", nights: 1, note: "" },
      { date: "2025-07-12", name: "暑假旅露營", nights: 3, note: "" },
      { date: "2025-03-22", name: "春季小隊露營", nights: 1, note: "" },
    ],
  },
  HK24015: {
    serviceRecords: [
      { date: "2026-04-05", name: "清明植樹服務", hours: 4, note: "" },
      { date: "2026-01-18", name: "社區清潔服務", hours: 3, note: "" },
      { date: "2025-12-20", name: "聖誕老人派禮物", hours: 5, note: "" },
      { date: "2025-11-02", name: "賣旗日", hours: 6, note: "" },
      { date: "2025-09-14", name: "校園清潔服務", hours: 2, note: "" },
      { date: "2025-08-23", name: "暑期社區服務日", hours: 8, note: "" },
      { date: "2025-06-08", name: "環保回收服務", hours: 4, note: "" },
    ],
    campingRecords: [
      { date: "2026-05-16", name: "長洲露營", nights: 2, note: "" },
      { date: "2026-02-21", name: "船灣郊野公園露營", nights: 1, note: "" },
      { date: "2025-12-06", name: "西貢露營", nights: 2, note: "" },
      { date: "2025-07-12", name: "暑假旅露營", nights: 3, note: "" },
    ],
  },
  HK25008: {
    serviceRecords: [
      { date: "2026-04-05", name: "清明植樹服務", hours: 4, note: "" },
      { date: "2026-01-18", name: "社區清潔服務", hours: 3, note: "" },
      { date: "2025-12-20", name: "聖誕老人派禮物", hours: 5, note: "" },
      { date: "2025-11-02", name: "賣旗日", hours: 4, note: "" },
    ],
    campingRecords: [
      { date: "2026-05-16", name: "長洲露營", nights: 2, note: "" },
      { date: "2025-12-06", name: "西貢露營", nights: 1, note: "" },
    ],
  },
};

for (const member of data.members) {
  if (!member.activity) continue;
  const demo = demos[member.scoutId];
  if (demo) {
    member.activity.serviceRecords = demo.serviceRecords;
    member.activity.campingRecords = demo.campingRecords;
    member.activity.serviceHours = demo.serviceRecords.reduce(
      (sum, r) => sum + r.hours,
      0
    );
    member.activity.campingCount = demo.campingRecords.length;
  } else {
    member.activity.serviceRecords = member.activity.serviceRecords || [];
    member.activity.campingRecords = member.activity.campingRecords || [];
  }
}

fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
console.log("done");
for (const id of Object.keys(demos)) {
  const m = data.members.find((x) => x.scoutId === id);
  console.log(
    id,
    m.name,
    "service",
    m.activity.serviceHours,
    "camp",
    m.activity.campingCount
  );
}
