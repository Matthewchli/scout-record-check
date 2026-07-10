const fs = require("fs");
const path = require("path");

const syllabus = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "progressive-syllabus.json"), "utf8")
);
const membersPath = path.join(__dirname, "..", "data", "members.json");
const data = JSON.parse(fs.readFileSync(membersPath, "utf8"));

/** Flatten progress units: elective tracks count only the chosen track's items. */
function progressUnits(badgeKey, preferredTrackId = "outdoor-elective") {
  const units = [];
  const electiveSeen = new Set();

  for (const section of syllabus[badgeKey].sections) {
    for (const sub of section.subsections) {
      if (sub.electiveGroup) {
        if (electiveSeen.has(sub.electiveGroup)) continue;
        electiveSeen.add(sub.electiveGroup);
        const tracks = [];
        for (const sec of syllabus[badgeKey].sections) {
          for (const s of sec.subsections) {
            if (s.electiveGroup === sub.electiveGroup) tracks.push(s);
          }
        }
        const chosen =
          tracks.find((t) => t.id === preferredTrackId) || tracks[0];
        for (const item of chosen.items) {
          units.push({ type: "item", ids: [item.id] });
        }
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
    itemCompletedDates: buildItemCompletedDates(completedIds, completedDate),
  };
}

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildItemCompletedDates(completedIds, badgeCompletedDate) {
  const dates = {};
  if (!completedIds.length) return dates;
  const end = badgeCompletedDate || new Date().toISOString().slice(0, 10);
  const span = Math.max(completedIds.length * 14, 90);
  const start = addDays(end, -span);
  const startMs = new Date(`${start}T12:00:00`).getTime();
  const endMs = new Date(`${end}T12:00:00`).getTime();
  completedIds.forEach((id, i) => {
    const t =
      completedIds.length === 1
        ? endMs
        : startMs + ((endMs - startMs) * i) / (completedIds.length - 1);
    dates[id] = new Date(t).toISOString().slice(0, 10);
  });
  return dates;
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
  if (profiles[m.name]) {
    m.progressiveBadges = profiles[m.name];
  }
}

function countProgress(key, completedIds) {
  const set = new Set(completedIds);
  const units = progressUnits(key);
  let done = 0;
  for (const unit of units) {
    if (unit.ids.some((id) => set.has(id))) done += 1;
  }
  return { done, total: units.length };
}

for (const [name, badges] of Object.entries(profiles)) {
  console.log(name);
  for (const b of badges) {
    const c = countProgress(b.key, b.completedIds);
    console.log(
      " ",
      b.key,
      b.status,
      `${c.done}/${c.total}`,
      b.completedIds.filter((id) => /-(4|5|6)/.test(id)).join(",")
    );
  }
}

fs.writeFileSync(membersPath, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log("updated members progressive completedIds");
