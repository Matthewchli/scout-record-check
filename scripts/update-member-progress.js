const fs = require("fs");
const path = require("path");

const syllabus = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "progressive-syllabus.json"), "utf8")
);
const membersPath = path.join(__dirname, "..", "data", "members.json");
const data = JSON.parse(fs.readFileSync(membersPath, "utf8"));

/** Flatten progress units: elective group counts as one unit (first item id represents it). */
function progressUnits(badgeKey) {
  const units = [];
  for (const section of syllabus[badgeKey].sections) {
    for (const sub of section.subsections) {
      if (sub.elective) {
        units.push({ type: "elective", ids: sub.items.map((i) => i.id) });
      } else {
        for (const item of sub.items) {
          units.push({ type: "item", ids: [item.id] });
        }
      }
    }
  }
  return units;
}

function makeBadge(key, status, completedDate, doneCount) {
  const units = progressUnits(key);
  let completedIds = [];

  if (status === "completed") {
    // 選修組只記第一個選項為已完成
    for (const unit of units) {
      completedIds.push(unit.ids[0]);
    }
  } else {
    const n = Math.min(doneCount, units.length);
    for (let i = 0; i < n; i++) {
      completedIds.push(units[i].ids[0]);
    }
  }

  return {
    key,
    name: syllabus[key].name,
    icon: syllabus[key].icon,
    status,
    completedDate,
    completedIds,
  };
}

const profiles = {
  陳志明: [
    makeBadge("discovery", "completed", "2023-03-12", 99),
    makeBadge("standard", "completed", "2024-06-20", 99),
    makeBadge("advanced", "in_progress", null, 10),
    makeBadge("chief", "not_started", null, 0),
  ],
  林美欣: [
    makeBadge("discovery", "completed", "2024-02-18", 99),
    makeBadge("standard", "in_progress", null, 8),
    makeBadge("advanced", "not_started", null, 0),
    makeBadge("chief", "not_started", null, 0),
  ],
  黃子軒: [
    makeBadge("discovery", "in_progress", null, 6),
    makeBadge("standard", "not_started", null, 0),
    makeBadge("advanced", "not_started", null, 0),
    makeBadge("chief", "not_started", null, 0),
  ],
};

for (const m of data.members) {
  m.progressiveBadges = profiles[m.name];
}

function countProgress(key, completedIds) {
  const set = new Set(completedIds);
  let done = 0;
  let total = 0;
  for (const unit of progressUnits(key)) {
    total += 1;
    if (unit.ids.some((id) => set.has(id))) done += 1;
  }
  return `${done}/${total}`;
}

fs.writeFileSync(membersPath, JSON.stringify(data, null, 2), "utf8");
console.log(
  "updated",
  data.members.map((m) =>
    m.progressiveBadges
      .map((b) => `${b.key}:${countProgress(b.key, b.completedIds)}`)
      .join(",")
  )
);
