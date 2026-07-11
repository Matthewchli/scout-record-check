const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "data", "specialty-syllabus.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const b = data.badges["skill:步操"];
if (b && b.items) {
  for (const it of b.items) {
    if (it.title && it.title.includes("完成 (A) 或 (B)")) {
      it.title = "完成 (A) 至 (B) 其中一項：";
    }
  }
}
fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log(data.badges["skill:步操"].items.map((i) => i.title).join(" | "));
