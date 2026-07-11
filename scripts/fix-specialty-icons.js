const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const membersPath = path.join(root, "data", "members.json");
const galleryPath = path.join(root, "data", "specialty-gallery.json");

const members = JSON.parse(fs.readFileSync(membersPath, "utf8"));
const gallery = JSON.parse(fs.readFileSync(galleryPath, "utf8"));

const byKey = {};
for (const g of gallery.groups || []) {
  for (const it of g.items || []) {
    byKey[it.key] = it.icon;
  }
}

function baseName(n) {
  return String(n || "")
    .replace(/（教導組）/g, "")
    .replace(/\(教導組\)/g, "")
    .trim()
    .replace(/章$/, "")
    .replace(/獎章$/, "")
    .replace(/徽章$/, "");
}

let fixed = 0;
const changes = [];

for (const m of members.members) {
  for (const b of m.specialtyBadges || []) {
    const group = b.group || "other";
    const name = baseName(b.name);
    const key = b.syllabusKey || `${group}:${name}`;
    const expected =
      byKey[key] || `assets/specialty/${group}/${name}.png`;
    if (b.icon !== expected) {
      changes.push({
        member: m.name,
        key,
        from: b.icon,
        to: expected,
      });
      b.icon = expected;
      fixed++;
    }
  }
}

fs.writeFileSync(membersPath, JSON.stringify(members, null, 2) + "\n", "utf8");
console.log("fixed", fixed);
changes.forEach((c) =>
  console.log(c.member, c.key, "\n ", c.from, "\n ", c.to)
);
