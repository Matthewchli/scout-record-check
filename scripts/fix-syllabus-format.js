const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "data", "specialty-syllabus.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));

// Fix 通訊 — (A)/(B) section structure like 手藝
data.badges["skill:通訊"].items = [
  { id: "intro-1", title: "完成 (A) 或 (B) 其中一項：", details: [] },
  {
    id: "sec-A",
    title: "(A)",
    details: [
      "1.",
      "(a) 用旗語以每分鐘四十五個字母的速率收發一不少過一百五十個字母的訊息，並用摩士訊號（發報機或訊號燈）以每分鐘二十五個字母的速率收發一不少於一百五十個字母的訊息；或",
      "(b) 用發報機以每分鐘四十個字母之速率及用訊號燈以每分鐘三十個字母的速率收發不少於一百五十個字母的訊息。",
      "2. 示範收訊及發訊的正確步驟。",
      "3. 在距離一百五十公尺外，以最少兩種方法使用旗語或摩士訊號以每分鐘二十個字母之速率發出一訊息。",
      "註：以上各測驗應有百份之八十的準確性。戶外收發站之最少距離應有一百四十公尺，發報機之收發站應設在不同之房間。",
    ],
  },
  {
    id: "sec-B",
    title: "(B)",
    details: [
      "1.",
      "(i) 於三個月內，紀錄五十個不同之業餘無綫電台，紀錄資料包括：時間、日期、該電台呼號、訊息強度、可讀性及電台位置。",
      "(ii) 與考驗員討論你對業餘無線電資料搜集紀錄之經驗，例如：發射、接收機使用方法、最遠可收聽到的訊息等。",
      "2. 與考驗員討論各業餘電台所使用的頻帶，明白日間與晚上，採用不同之頻率通訊時可達到的範圍。",
      "3. 明確解說最少十二個國際上使用的「Q」訊息。",
      "4. 清楚香港電訊管理局對使用無線電手提對講機的規定。",
    ],
  },
];

// Fix 手藝 (D)：拆開 (a)/(b)
const craft = data.badges["skill:手藝"];
const secD = craft.items.find((i) => i.id === "sec-D");
if (secD) {
  secD.details = [
    "1.",
    "(a) 用釘及線把一對皮鞋或皮靴之鞋底釘縫妥當；或",
    "(b) 製造一件設計新穎及著色之用具，如手提包、皮夾或錢袋等，認識怎樣使用及調製各種染料。",
    "2. 對所用之工具有良好之認識。",
    "3. 認識各類皮革的用途及怎樣去選擇。",
  ];
}

function splitLetterOptions(line) {
  const re = /\(([a-zivx]+)\)\s*/gi;
  const matches = [...String(line).matchAll(re)];
  if (matches.length < 2) return [line];
  const parts = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : line.length;
    parts.push(line.slice(start, end).trim());
  }
  return parts.filter(Boolean);
}

// Fix 烹飪：同一行多個選項拆成獨立行
const cook = data.badges["skill:烹飪（中式）"];
if (cook) {
  for (const it of cook.items) {
    const next = [];
    for (const d of it.details || []) {
      if (/^[甲乙丙]組/.test(d)) {
        next.push(d);
        continue;
      }
      for (const p of splitLetterOptions(d)) {
        const m = p.match(/^(.*?)(丙組.*)$/);
        if (m && /\([a-z]\)/i.test(m[1]) && m[2]) {
          next.push(m[1].trim());
          next.push(m[2].trim());
        } else {
          next.push(p);
        }
      }
    }
    it.details = next;
  }
}

// 攝影：標題統一為「完成下列其中一項」，(a)/(b) 同在 details
const photo = data.badges["interest:攝影"];
if (photo) {
  const i2 = photo.items.find((i) => i.id === "item-2");
  const i4 = photo.items.find((i) => i.id === "item-4");
  if (i2) i2.title = "2. 完成下列其中一項：";
  if (i4) i4.title = "4. 完成下列其中一項：";
}

const conserve = data.badges["service:護養"];
if (conserve) {
  for (const [id, title] of [
    ["item-1", "1. 完成下列各項："],
    ["item-2", "2. 完成下列各項："],
    ["item-3", "3. 完成下列各項："],
  ]) {
    const it = conserve.items.find((x) => x.id === id);
    if (it) it.title = title;
  }
}

const lead = data.badges["other:領導才獎章"];
if (lead) {
  for (const id of ["item-4", "item-5", "item-7"]) {
    const it = lead.items.find((x) => x.id === id);
    if (!it) continue;
    const n = (it.title.match(/^(\d+)\./) || [])[1];
    if (n) it.title = `${n}. 完成下列其中一項：`;
  }
}

const rescue = data.badges["service:拯溺"];
if (rescue) {
  const i2 = rescue.items.find((i) => i.id === "item-2");
  if (i2) i2.title = "2. 完成下列其中一項：";
}

const civics = data.badges["service:公民"];
if (civics) {
  const i1 = civics.items.find((i) => i.id === "item-1");
  if (i1) i1.title = "1. 完成下列其中一項：";
}

fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log("done");
console.log("攝影2", JSON.stringify(data.badges["interest:攝影"].items[1], null, 2));
console.log("通訊", data.badges["skill:通訊"].items.map((i) => i.title).join(" | "));
