const fs = require("fs");
const path = require("path");

const membersPath = path.join(__dirname, "..", "data", "members.json");
const activitiesPath = path.join(__dirname, "..", "data", "activities.json");
const DEMO_IDS = new Set(["HK24001", "HK24015", "HK25008"]);

function syncMemberActivityDetails(member, actByDate) {
  const present = (member.attendance || []).filter((r) => r.status === "present");
  const serviceRecords = [];
  const campingRecords = [];
  const outdoorActivities = [];

  for (const r of present) {
    const act = actByDate.get(r.date);
    const type = act ? act.type : r.type;
    const name = act ? act.name : r.name;
    const note = (act && act.location) || "";

    if (type === "服務") {
      serviceRecords.push({
        date: r.date,
        name,
        hours: act && act.hours != null ? act.hours : 0,
        note,
      });
    } else if (type === "露營") {
      campingRecords.push({
        date: r.date,
        name,
        nights: act && act.nights != null ? act.nights : 1,
        note,
      });
    } else if (type === "戶外") {
      outdoorActivities.push({
        date: r.date,
        name,
        type: "戶外",
        note,
      });
    }
  }

  const byDateDesc = (a, b) => b.date.localeCompare(a.date);
  serviceRecords.sort(byDateDesc);
  campingRecords.sort(byDateDesc);
  outdoorActivities.sort(byDateDesc);

  member.activity = member.activity || {};
  member.activity.serviceRecords = serviceRecords;
  member.activity.campingRecords = campingRecords;
  member.activity.outdoorActivities = outdoorActivities;
  member.activity.serviceHours = serviceRecords.reduce(
    (s, r) => s + (Number(r.hours) || 0),
    0
  );
  member.activity.campingCount = campingRecords.length;
}

function main() {
  const onlyReal = !process.argv.includes("--all");
  const data = JSON.parse(fs.readFileSync(membersPath, "utf8"));
  const acts = JSON.parse(fs.readFileSync(activitiesPath, "utf8")).activities;
  const actByDate = new Map(acts.map((a) => [a.date, a]));

  let n = 0;
  for (const member of data.members) {
    if (onlyReal && DEMO_IDS.has(member.scoutId)) continue;
    syncMemberActivityDetails(member, actByDate);
    n += 1;
  }

  fs.writeFileSync(membersPath, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("synced activity details for", n, "members");
}

if (require.main === module) main();

module.exports = { syncMemberActivityDetails, DEMO_IDS };
