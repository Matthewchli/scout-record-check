/**
 * 1) Restore 2026-07-16 specialty rows + certificateNumber (if missing after accidental revert)
 * 2) Copy certificate images → assets/certificates/ and set certificateCopy
 * Never overwrites existing noticeUrl / noticeTitle / certificateCopy.
 */
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const srcRoot = path.join(
  "C:",
  "Users",
  "heiin",
  "Desktop",
  "童軍管理平台",
  "證書副本"
);
const destDir = path.join(projectRoot, "assets", "certificates");
const membersPath = path.join(projectRoot, "data", "members.json");

const NOTICE_ASSESSMENT = {
  noticeUrl: "assets/notices/20260705-specialty-assessment-day.pdf",
  noticeTitle: "沙田東區 童軍專科徽章考驗日2026",
};

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) {
    console.error("Source missing:", dir);
    return out;
  }
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function parseFile(filePath) {
  const base = path.basename(filePath);
  const ext = path.extname(base);
  const stem = base.slice(0, -ext.length).trim();
  const certMatch = stem.match(/STE\.S\.FY\d+\.\d+/i);
  const certDot = certMatch ? certMatch[0].toUpperCase() : null;
  const certSlash = certDot ? certDot.replace(/\./g, "/") : null;
  const withoutCert = (certDot ? stem.replace(new RegExp(certDot, "i"), "") : stem)
    .trim()
    .replace(/\s+/g, " ");
  const parts = withoutCert.split(" ").filter(Boolean);
  const personName = parts[0] || "";
  let badgeName = "";
  for (let i = parts.length - 1; i >= 1; i--) {
    if (/章$/.test(parts[i])) {
      badgeName = parts[i];
      break;
    }
  }
  if (!badgeName) {
    const m = withoutCert.match(/([\u4e00-\u9fff]+章)/);
    if (m) badgeName = m[1];
  }
  return { filePath, base, ext, personName, badgeName, certSlash };
}

function normalizeCert(n) {
  return String(n || "")
    .replace(/\./g, "/")
    .toUpperCase();
}

function destFileName(scoutId, badgeName, certSlash, ext) {
  const id = String(scoutId || "unknown").replace(/[^\w-]/g, "");
  const badge = String(badgeName || "badge").replace(
    /[^\u4e00-\u9fffA-Za-z0-9_-]/g,
    ""
  );
  const cert = certSlash ? certSlash.replace(/\//g, "-") : "nocert";
  const e = ext.toLowerCase() === ".jpg" ? ".jpeg" : ext.toLowerCase();
  return `${id}_${badge}_${cert}${e}`;
}

function makeBadge({
  name,
  category,
  group,
  date,
  syllabusKey,
  certificateNumber,
}) {
  const badge = {
    name,
    earnedDate: date,
    category,
    group,
    icon: `assets/specialty/${group}/${name.replace(/章$/, "")}.png`,
    activityName: `${category} - ${name}`,
    organizer: "沙田東區",
    assessmentDate: date,
    syllabusKey,
    examiner: "謝志安先生",
    examinerTitle: "童軍區長",
  };
  if (certificateNumber) badge.certificateNumber = certificateNumber;
  // Only seed notice if neither field exists (do not clobber other agent)
  badge.noticeUrl = NOTICE_ASSESSMENT.noticeUrl;
  badge.noticeTitle = NOTICE_ASSESSMENT.noticeTitle;
  return badge;
}

function findBadge(member, { name, date, syllabusKey }) {
  return (member.specialtyBadges || []).find((b) => {
    const d = b.assessmentDate || b.earnedDate;
    if (syllabusKey && b.syllabusKey === syllabusKey && d === date) return true;
    if (name && b.name === name && d === date) return true;
    return false;
  });
}

function ensureCertNumber(member, match, certificateNumber) {
  const b = findBadge(member, match);
  if (!b) return { ok: false, reason: "badge missing" };
  if (!b.certificateNumber && !b.certNo) {
    b.certificateNumber = certificateNumber;
    return { ok: true, action: "set" };
  }
  return { ok: true, action: "kept" };
}

function ensureBadge(member, spec) {
  const existing = findBadge(member, {
    name: spec.name,
    date: spec.date,
    syllabusKey: spec.syllabusKey,
  });
  if (existing) {
    if (spec.certificateNumber && !existing.certificateNumber && !existing.certNo) {
      existing.certificateNumber = spec.certificateNumber;
    }
    // Do not overwrite notice*
    return { action: "exists" };
  }
  member.specialtyBadges = member.specialtyBadges || [];
  member.specialtyBadges.unshift(makeBadge(spec));
  return { action: "added" };
}

// --- load latest members.json ---
const data = JSON.parse(fs.readFileSync(membersPath, "utf8"));
const byId = new Map(data.members.map((m) => [m.scoutId, m]));
const byName = new Map(data.members.map((m) => [m.name, m]));

const restoreLog = { certFilled: 0, badgesAdded: 0 };

// Fill certificate numbers on existing rows
const certFills = [
  { id: "2025045135", name: "觀察章", date: "2026-07-05", key: "skill:觀察", cert: "STE/S/FY2627/038" },
  { id: "2025045135", name: "手藝章", date: "2026-07-05", key: "skill:手藝", cert: "STE/S/FY2627/014" },
  { id: "2025045135", name: "模型製作章", date: "2026-07-05", key: "interest:模型製作", cert: "STE/S/FY2627/104" },
  { id: "2025045135", name: "運動章", date: "2026-07-05", key: "interest:運動", cert: "STE/S/FY2627/084" },
  { id: "2025021912", name: "語言章", date: "2026-07-05", key: "service:語言", cert: "STE/S/FY2627/059" },
  { id: "2025021912", name: "手藝章", date: "2026-07-05", key: "skill:手藝", cert: "STE/S/FY2627/011" },
  { id: "2025021912", name: "藝術章", date: "2026-07-05", key: "interest:藝術", cert: "STE/S/FY2627/095" },
  { id: "2025021912", name: "模型製作章", date: "2026-07-05", key: "interest:模型製作", cert: "STE/S/FY2627/099" },
  { id: "2025021912", name: "攝影章", date: "2026-07-05", key: "interest:攝影", cert: "STE/S/FY2627/112" },
  { id: "2025098332", name: "手藝章", date: "2026-07-05", key: "skill:手藝", cert: "STE/S/FY2627/018" },
  { id: "2025098332", name: "攝影章", date: "2026-07-05", key: "interest:攝影", cert: "STE/S/FY2627/112" },
];

for (const row of certFills) {
  const m = byId.get(row.id);
  const r = ensureCertNumber(
    m,
    { name: row.name, date: row.date, syllabusKey: row.key },
    row.cert
  );
  if (r.action === "set") restoreLog.certFilled += 1;
}

// Add 2026-07-16 rows if missing
const newBadges = [
  {
    id: "2025021912",
    name: "觀察章",
    category: "技能組",
    group: "skill",
    date: "2026-07-16",
    syllabusKey: "skill:觀察",
    certificateNumber: "STE/S/FY2627/121",
  },
  {
    id: "2025021599",
    name: "語言章",
    category: "服務組",
    group: "service",
    date: "2026-07-16",
    syllabusKey: "service:語言",
  },
  {
    id: "2025021599",
    name: "手藝章",
    category: "技能組",
    group: "skill",
    date: "2026-07-16",
    syllabusKey: "skill:手藝",
  },
  {
    id: "2025021599",
    name: "觀察章",
    category: "技能組",
    group: "skill",
    date: "2026-07-16",
    syllabusKey: "skill:觀察",
  },
  {
    id: "2025098332",
    name: "觀察章",
    category: "技能組",
    group: "skill",
    date: "2026-07-16",
    syllabusKey: "skill:觀察",
    certificateNumber: "STE/S/FY2627/122",
  },
];

for (const spec of newBadges) {
  const m = byId.get(spec.id);
  const r = ensureBadge(m, spec);
  if (r.action === "added") restoreLog.badgesAdded += 1;
}

console.log("Restore:", restoreLog);

// --- copy + link certificate files ---
const files = walk(srcRoot).filter((f) =>
  /\.(jpe?g|png|pdf|webp)$/i.test(f)
);
const parsed = files.map(parseFile);
console.log("Source files:", parsed.length);

fs.mkdirSync(destDir, { recursive: true });

const report = { copied: [], linked: [], unmatchedFiles: [] };

for (const p of parsed) {
  const member = byName.get(p.personName);
  if (!member) {
    report.unmatchedFiles.push({
      file: p.base,
      reason: `找不到成員: ${p.personName}`,
    });
    continue;
  }
  const badges = member.specialtyBadges || [];
  let badge = null;
  if (p.certSlash) {
    badge = badges.find(
      (b) =>
        normalizeCert(b.certificateNumber || b.certNo) === p.certSlash &&
        (!p.badgeName || b.name === p.badgeName)
    );
    if (!badge) {
      badge = badges.find(
        (b) => normalizeCert(b.certificateNumber || b.certNo) === p.certSlash
      );
    }
  }
  if (!badge && p.badgeName) {
    badge = badges.find(
      (b) => b.name === p.badgeName && !b.certificateCopy && !b.certCopy
    );
  }
  if (!badge && p.badgeName) {
    badge = badges.find((b) => b.name === p.badgeName);
  }
  if (!badge) {
    report.unmatchedFiles.push({
      file: p.base,
      reason: `對不上徽章: ${p.personName} / ${p.badgeName} / ${p.certSlash || ""}`,
    });
    continue;
  }

  const destName = destFileName(
    member.scoutId,
    p.badgeName || badge.name,
    p.certSlash,
    p.ext
  );
  const destPath = path.join(destDir, destName);
  fs.copyFileSync(p.filePath, destPath);
  const rel = `assets/certificates/${destName}`;
  if (!badge.certificateCopy && !badge.certCopy) {
    badge.certificateCopy = rel;
  }
  report.copied.push(destName);
  report.linked.push({
    member: member.name,
    scoutId: member.scoutId,
    badge: badge.name,
    cert: badge.certificateNumber || "",
    path: badge.certificateCopy || badge.certCopy || rel,
  });
}

fs.writeFileSync(membersPath, JSON.stringify(data, null, 2) + "\n", "utf8");

console.log("\n=== REPORT ===");
console.log(JSON.stringify(report, null, 2));
console.log(`Copied: ${report.copied.length}`);
console.log(`Linked: ${report.linked.length}`);
console.log(`Unmatched files: ${report.unmatchedFiles.length}`);
