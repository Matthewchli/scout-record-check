const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "data", "specialty-syllabus.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));

// 通訊：完成 (A) 至 (B)；ABC > 123 > abc
data.badges["skill:通訊"].items = [
  { id: "intro-1", title: "完成 (A) 至 (B) 其中一項：", details: [] },
  {
    id: "sec-A",
    title: "(A)",
    details: [
      "1. 完成下列其中一項：",
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
      "1. 完成下列各項：",
      "(a) 於三個月內，紀錄五十個不同之業餘無綫電台，紀錄資料包括：時間、日期、該電台呼號、訊息強度、可讀性及電台位置。",
      "(b) 與考驗員討論你對業餘無線電資料搜集紀錄之經驗，例如：發射、接收機使用方法、最遠可收聽到的訊息等。",
      "2. 與考驗員討論各業餘電台所使用的頻帶，明白日間與晚上，採用不同之頻率通訊時可達到的範圍。",
      "3. 明確解說最少十二個國際上使用的「Q」訊息。",
      "4. 清楚香港電訊管理局對使用無線電手提對講機的規定。",
    ],
  },
];

// 先鋒工程 intro 用「至」
const pioneer = data.badges["skill:先鋒工程"];
if (pioneer && pioneer.items[0]) {
  pioneer.items[0].title = "完成 (A) 至 (B) 其中一項：";
}

fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log("通訊", data.badges["skill:通訊"].items[0].title);
console.log("B1", data.badges["skill:通訊"].items[2].details[1]);
console.log("先鋒", data.badges["skill:先鋒工程"].items[0].title);
