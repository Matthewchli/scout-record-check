const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const membersPath = path.join(__dirname, "..", "data", "members.json");
const syllabus = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "data", "progressive-syllabus.json"),
    "utf8"
  )
);

const DEMO_IDS = new Set(["2025000101", "2025000102", "2025000103"]);

const BADGE_KEY = {
  探索: "discovery",
  標準: "standard",
  高級: "advanced",
  總領袖: "chief",
};

const KEY_PREFIX = {
  discovery: "d",
  standard: "s",
  advanced: "a",
  chief: "c",
};

const NAME_ALIASES = {
  楊淳𤋮: "楊淳熙",
  梁諾言: "梁諾然",
};

function excelDateToIso(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    const epoch = Date.UTC(1899, 11, 30);
    const d = new Date(epoch + value * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

function parseActivity(name) {
  const m = String(name).match(
    /^(探索|標準|高級|總領袖)獎章\s*([A-E])\.[^\d]*?(\d+)\.\s*[^(]*?\(([a-z])\)\s*$/i
  );
  if (!m) return null;
  const key = BADGE_KEY[m[1]];
  const id = `${KEY_PREFIX[key]}-${m[2].toLowerCase()}-${m[3]}${m[4].toLowerCase()}`;
  return { key, id };
}

function allSyllabusIds() {
  const ids = new Set();
  for (const badge of Object.values(syllabus)) {
    for (const section of badge.sections || []) {
      for (const sub of section.subsections || []) {
        for (const item of sub.items || []) ids.add(item.id);
      }
    }
  }
  return ids;
}

function collectElectiveTracks(syl, groupId) {
  const tracks = [];
  for (const section of syl.sections || []) {
    for (const sub of section.subsections || []) {
      if (sub.electiveGroup === groupId) tracks.push(sub);
    }
  }
  return tracks;
}

function chooseElectiveTrack(tracks, completedSet) {
  if (!tracks.length) return { items: [] };
  let best = tracks[0];
  let bestScore = -1;
  for (const track of tracks) {
    const score = track.items.filter((it) => completedSet.has(it.id)).length;
    if (score > bestScore) {
      best = track;
      bestScore = score;
    }
  }
  return best;
}

function progressOf(key, completedIds) {
  const syl = syllabus[key];
  if (!syl) return { done: 0, total: 0, pct: 0 };
  const completed = new Set(completedIds || []);
  let done = 0;
  let total = 0;
  const electiveSeen = new Set();

  for (const section of syl.sections || []) {
    for (const sub of section.subsections || []) {
      if (sub.electiveGroup) {
        if (electiveSeen.has(sub.electiveGroup)) continue;
        electiveSeen.add(sub.electiveGroup);
        const tracks = collectElectiveTracks(syl, sub.electiveGroup);
        const chosen = chooseElectiveTrack(tracks, completed);
        total += chosen.items.length;
        done += chosen.items.filter((it) => completed.has(it.id)).length;
      } else {
        for (const item of sub.items || []) {
          total += 1;
          if (completed.has(item.id)) done += 1;
        }
      }
    }
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

function deriveStatus(completedIds, itemCompletedDates, key) {
  const { done, total } = progressOf(key, completedIds);
  if (!done) {
    return { status: "not_started", completedDate: null };
  }
  if (done >= total && total > 0) {
    const dates = Object.values(itemCompletedDates || {}).filter(Boolean).sort();
    return {
      status: "completed",
      completedDate: dates.length ? dates[dates.length - 1] : null,
    };
  }
  return { status: "in_progress", completedDate: null };
}

function emptyBadge(key, name, icon) {
  return {
    key,
    name,
    icon,
    status: "not_started",
    completedDate: null,
    completedIds: [],
    itemCompletedDates: {},
  };
}

function ensureProgressiveBadges(member) {
  const template = [
    ["discovery", "探索獎章", "assets/badge-discovery.png"],
    ["standard", "標準獎章", "assets/badge-standard.png"],
    ["advanced", "高級獎章", "assets/badge-advanced.png"],
    ["chief", "總領袖獎章", "assets/badge-chief.png"],
  ];
  if (!Array.isArray(member.progressiveBadges)) member.progressiveBadges = [];
  const byKey = new Map(member.progressiveBadges.map((b) => [b.key, b]));
  member.progressiveBadges = template.map(([key, name, icon]) => {
    const existing = byKey.get(key);
    if (existing) return existing;
    return emptyBadge(key, name, icon);
  });
}

function main() {
  const knownIds = allSyllabusIds();
  const wb = XLSX.readFile(
    "c:/Users/heiin/Desktop/童軍管理平台/進度性獎章.xlsx"
  );
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    defval: "",
  });

  // Validate mapping
  const acts = [...new Set(rows.map((r) => r["活動名稱"]))];
  const unmapped = [];
  for (const a of acts) {
    const p = parseActivity(a);
    if (!p || !knownIds.has(p.id)) unmapped.push({ a, p });
  }
  if (unmapped.length) {
    console.error("unmapped activities:");
    unmapped.forEach((u) => console.error(" ", u.a, u.p));
    process.exit(1);
  }
  console.log("mapped activities", acts.length);

  // person -> itemId -> earliest date
  const progress = new Map();
  let skippedResult = 0;
  for (const r of rows) {
    if (String(r["成績/參與情況"]).trim() !== "合格") {
      skippedResult++;
      continue;
    }
    let name = String(r["姓名"]).trim();
    name = NAME_ALIASES[name] || name;
    const parsed = parseActivity(r["活動名稱"]);
    const date = excelDateToIso(r["舉辦日期"]);
    if (!parsed || !date) continue;

    if (!progress.has(name)) progress.set(name, new Map());
    const items = progress.get(name);
    const prev = items.get(parsed.id);
    if (!prev || date < prev.date) {
      items.set(parsed.id, { date, key: parsed.key });
    }
  }

  const data = JSON.parse(fs.readFileSync(membersPath, "utf8"));
  const byName = new Map();
  for (const m of data.members) {
    if (DEMO_IDS.has(m.scoutId)) continue;
    byName.set(m.name, m);
  }

  let updatedMembers = 0;
  let updatedItems = 0;
  const excelOnly = [];
  const noExcel = [];

  for (const [name, items] of progress.entries()) {
    const member = byName.get(name);
    if (!member) {
      excelOnly.push(name);
      continue;
    }
    ensureProgressiveBadges(member);

    // Reset real-account progressive progress before applying Excel
    for (const badge of member.progressiveBadges) {
      badge.completedIds = [];
      badge.itemCompletedDates = {};
      badge.status = "not_started";
      badge.completedDate = null;
    }

    const byBadge = new Map(
      member.progressiveBadges.map((b) => [b.key, b])
    );
    for (const [itemId, meta] of items.entries()) {
      const badge = byBadge.get(meta.key);
      if (!badge) continue;
      if (!badge.completedIds.includes(itemId)) badge.completedIds.push(itemId);
      badge.itemCompletedDates[itemId] = meta.date;
      updatedItems++;
    }

    for (const badge of member.progressiveBadges) {
      badge.completedIds.sort();
      const derived = deriveStatus(
        badge.completedIds,
        badge.itemCompletedDates,
        badge.key
      );
      badge.status = derived.status;
      badge.completedDate = derived.completedDate;
    }

    updatedMembers++;
  }

  for (const m of data.members) {
    if (DEMO_IDS.has(m.scoutId)) continue;
    if (!progress.has(m.name)) noExcel.push(m.name);
  }

  fs.writeFileSync(membersPath, JSON.stringify(data, null, 2) + "\n", "utf8");

  console.log("updated members", updatedMembers);
  console.log("updated item records", updatedItems);
  console.log("skipped non-pass rows", skippedResult);
  console.log("excel names without account:", excelOnly.sort().join(", ") || "(none)");
  console.log("accounts without excel rows:", noExcel.sort().join(", ") || "(none)");

  // sample
  const sample = data.members.find((m) => m.name === "蔣禮謙");
  if (sample) {
    for (const b of sample.progressiveBadges) {
      console.log(
        sample.name,
        b.key,
        b.status,
        b.completedIds.length,
        b.completedDate || "-"
      );
    }
  }
}

main();
