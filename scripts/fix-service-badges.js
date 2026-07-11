const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "data", "specialty-syllabus.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));

function service(name, englishName, items, note = "") {
  const key = `service:${name}`;
  data.badges[key] = {
    key,
    name,
    englishName,
    group: "service",
    category: "服務組",
    intro: "",
    note,
    items,
  };
}

service("營地管理", "Camp Warden", [
  { id: "intro-1", title: "完成下列各項：", details: [] },
  {
    id: "item-1",
    title: "1. 曾在最少三個不同地點露營十晚。",
    details: [],
  },
  {
    id: "item-2",
    title:
      "2. 曾固定在一個童軍營地協助營地管理員七日或以上，而其工作表現能令有關管理人員滿意。",
    details: [],
  },
  {
    id: "item-3",
    title: "3. 示範下列任何三項：",
    details: [
      "(a) 用炭烹飪。",
      "(b) 架設營火。",
      "(c) 架搭一小隊營帳。",
      "(d) 在營地弄乾濕衣物及寢具。",
      "(e) 營地防火措施。",
    ],
  },
  {
    id: "item-4",
    title: "4. 闡述在營地處理下列任何四項之方法，必要時加以示範：",
    details: [
      "(a) 食物之貯藏。",
      "(b) 食水之處理。",
      "(c) 爐灶及非個人用品之處理。",
      "(d) 廢物之清理。",
      "(e) 廁所之處理。",
    ],
  },
  {
    id: "item-5",
    title: "5. 對「露營的標準」有基本知識。",
    details: [],
  },
  {
    id: "item-6",
    title: "6. 收拾一個適合一小隊一星期露營用之急救箱。",
    details: [],
  },
  {
    id: "item-7",
    title: "7. 示範使用下列任何三項工具：",
    details: [
      "(a) 手斧。",
      "(b) 弓字鋸。",
      "(c) 大木鎚。",
      "(d) 錛子。",
      "(e) 修剪樹枝的工具。",
      "(f) 任何機動器具，例如：剪草機、電鋸及電鑽。",
    ],
  },
  {
    id: "item-8",
    title: "8. 與主考討論你對所熟悉之固定營地將來的改進和發展。",
    details: [
      "完成此章而當中包括不少於十五小時的服務，可與香港青年獎勵計劃銅章級服務科之相應項目對等。",
    ],
  },
]);

service("獨木舟救生", "Canoe Rescuer", [
  { id: "intro-1", title: "完成下列各項：", details: [] },
  {
    id: "item-1",
    title: "1. 持有本會之有效游泳測試證明書。",
    details: [],
  },
  {
    id: "item-2",
    title:
      "2. 考獲香港獨木舟總會初級獨木舟救生員證書／香港拯溺總會獨木舟拯救章。",
    details: [
      "註：此專章之課程以該項運動之所屬總會所頒佈的最新課程為依歸。",
      "完成此章，可與香港青年獎勵計劃銅章級服務科之相應項目對等。",
    ],
  },
]);

service("公民", "Civics", [
  { id: "intro-1", title: "完成下列各項：", details: [] },
  {
    id: "item-1",
    title: "1.",
    details: [
      "(a) 完成本會認許之公民章訓練班；或",
      "(b) 明瞭下列各項：",
      "(i) 認識祖國及香港特別行政區",
      "． 認識祖國的歷史文化、地理和公共行政。",
      "． 認識香港特別行政區的歷史文化、地理和公共行政。",
      "． 認識中央與香港特別行政區的關係。",
      "． 認識基本法。",
      "． 明瞭香港特別行政區的行政、立法及司法制度，其產生、組織、功能和職責。",
      "． 認識香港特別行政區政府組織架構。",
      "(ii) 認識社區",
      "． 認識何謂社區。",
      "． 認識社區內可提供之設施。",
      "． 明瞭社區組職可提供之支援和服務。",
      "． 明瞭區議會的產生、組織、功能和職責。",
      "． 認識義務工作的定義、範疇和籌劃方法。",
      "(iii) 認識公民的權利及義務",
      "． 認識公民的定義、權利和義務。",
      "． 明瞭公民應有的價值觀和態度（包括人權與責任、承擔精神、誠信及國民身份認同）。",
      "． 認識公民教育委員會的工作。",
    ],
  },
  {
    id: "item-2",
    title: "2. 專題研習",
    details: [
      "完成下列其中一項：",
      "(a) 於導修員指導下，以小組形式編寫一份社區參與服務計劃書，並依照計劃內容完成一個不少於兩小時之實際社區參與服務，並於完成後呈交活動報告書；或",
      "(b) 參與一項由班領導人、地域、區會或旅團安排之實際社區參與服務，而該服務（可多於一項）時數應不少於六小時，並於完成後呈交活動報告書。",
      "完成此章而學習或練習的時間不少於六個月，可與香港青年獎勵計劃銅章級技能科之相應項目對等。",
    ],
  },
]);

fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");

for (const k of ["service:營地管理", "service:獨木舟救生", "service:公民"]) {
  const b = data.badges[k];
  console.log(
    k,
    "items=",
    b.items.length,
    "|",
    b.items.map((i) => i.title).join(" / ")
  );
}
