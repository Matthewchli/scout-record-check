const fs = require("fs");
const text = fs.readFileSync("data/specialty-syllabus.json", "utf8");
const keys = [...text.matchAll(/"(skill:[^"]+)"\s*:/g)].map((m) => m[1]);
const counts = {};
for (const k of keys) counts[k] = (counts[k] || 0) + 1;
const dups = Object.entries(counts).filter(([, c]) => c > 1);
console.log("dup count", dups.length);
dups.forEach(([k, c]) => console.log(c, k));

const d = JSON.parse(text);
const need = [
  "skill:射箭",
  "skill:獨木舟",
  "skill:步操",
  "skill:氣象",
  "skill:風帆",
  "skill:通訊",
  "skill:領航",
  "skill:風帆賽艇舵手",
  "skill:體育",
  "skill:國際友誼",
  "skill:野外定向",
  "skill:先鋒工程",
];
for (const k of need) {
  console.log(k, !!d.badges[k], d.badges[k] && d.badges[k].items.length);
}
