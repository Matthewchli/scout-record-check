const fs = require("fs");
const path = require("path");

const text = fs.readFileSync(path.join(__dirname, "..", "tmp", "pdf-full.txt"), "utf8");

const GROUP_FROM_LABEL = {
  興趣組: "interest",
  技能組: "skill",
  服務組: "service",
  教導組: "instructor",
};

const CATEGORY_FROM_GROUP = {
  interest: "興趣組",
  skill: "技能組",
  service: "服務組",
  instructor: "教導組",
  other: "其他獎章及徽章",
};

function unspaceChinese(s) {
  return String(s || "")
    .replace(/[ \t]+/g, "")
    .replace(/\n+/g, "")
    .trim();
}

function cleanLine(line) {
  return String(line || "")
    .replace(/\t/g, " ")
    .replace(/[ \u00a0]+/g, " ")
    .trim();
}

function isNoiseLine(line) {
  return (
    !line ||
    /^-- \d+ of \d+ --$/.test(line) ||
    /^\d+ \| /.test(line) ||
    / \| \d+$/.test(line) ||
    /^專科徽章/.test(line) ||
    /^專科$/.test(line) ||
    /^其他獎章及徽章$/.test(line) ||
    /^其他$/.test(line) ||
    /^\($/.test(line) ||
    /^\)$/.test(line) ||
    /^(興趣組|技能組|服務組|教導組)$/.test(line)
  );
}

function extractIntro(_body) {
  // 不顯示「完成下列各項／持有下列其中一項」等提示
  return "";
}

function extractNote(body) {
  // 不保留「香港青年獎勵計劃」對等提示
  return "";
}

function parseItems(body) {
  let work = body;
  const cutPatterns = [
    /\n完成此章而/,
    /\n完成此章，/,
    /\n完成此章後/,
    /\n持續參與活動不少於/,
    /\n持續參與不少於/,
  ];
  let cut = -1;
  for (const re of cutPatterns) {
    const m = work.search(re);
    if (m >= 0 && (cut < 0 || m < cut)) cut = m;
  }
  if (cut > 0) work = work.slice(0, cut);

  work = work.replace(
    /^(完成[^\n]*|持有下列其中一項[^\n]*|適合[^\n]*)\n/,
    ""
  );

  const lines = work
    .split(/\n/)
    .map(cleanLine)
    .filter((l) => !isNoiseLine(l));

  const items = [];
  let current = null;

  function pushCurrent() {
    if (!current) return;
    current.title = current.title.replace(/\s+/g, " ").trim();
    current.details = current.details
      .map((d) => d.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (current.title) items.push(current);
    current = null;
  }

  for (const line of lines) {
    const major = line.match(/^(\d+)\.\s*(.*)$/);
    const section = line.match(/^\(([A-D])\)\s*(.*)$/);
    const letter = line.match(/^\(([a-zivx]+)\)\s*(.*)$/i);
    const roman = line.match(/^([IVX]+)\.\s*(.*)$/);
    const noteLine = line.match(/^註[：:].*$/);

    if (major) {
      pushCurrent();
      current = {
        id: `item-${items.length + 1}`,
        title: `${major[1]}. ${major[2]}`.trim(),
        details: [],
      };
      continue;
    }
    if (section && !letter) {
      // (A) section headers
      if (/^[A-D]$/.test(section[1])) {
        pushCurrent();
        current = {
          id: `sec-${section[1]}`,
          title: `(${section[1]}) ${section[2]}`.trim() || `(${section[1]})`,
          details: [],
        };
        continue;
      }
    }
    if (current && (letter || roman || noteLine || /^[．·•]/.test(line))) {
      current.details.push(line.replace(/^[．·•]\s*/, ""));
      continue;
    }
    if (current) {
      if (current.details.length) {
        current.details[current.details.length - 1] += line;
      } else {
        current.title += line;
      }
    }
  }
  pushCurrent();
  return items;
}

const badges = {};

const headerRe =
  /專科徽章?\s*\(?\s*\n?\s*\(?\s*\n?\s*(興趣組|技能組|服務組|教導組)\s*\n?\s*\)\s*\n+([^\nA-Za-z0-9]{1,30})\n([A-Za-z][A-Za-z0-9 &'()\-\/’']*)\n([\s\S]*?)(?=專科徽章?\s*\(?\s*\n?\s*\(?\s*\n?\s*(?:興趣組|技能組|服務組|教導組)|童軍專科徽章（|教導組專科徽章|海上活動徽章|航空活動徽章|其他獎章及徽章|服\s*務\s*獎\s*章|附錄|$)/g;

let match;
let count = 0;
while ((match = headerRe.exec(text)) !== null) {
  const groupLabel = match[1];
  const name = unspaceChinese(match[2]);
  const englishName = match[3].trim();
  const body = match[4];

  if (!name || name.length > 18) continue;
  if (/目錄|引言|支部|進度|教導組專科徽章/.test(name)) continue;
  // 手藝等章可能因跨頁，開頭「完成」落在較後；放寬至前 800 字
  if (!/完成|持有/.test(body.slice(0, 800))) continue;

  const group = GROUP_FROM_LABEL[groupLabel];
  const key = `${group}:${name}`;
  badges[key] = {
    key,
    name,
    englishName,
    group,
    category: CATEGORY_FROM_GROUP[group],
    intro: extractIntro(body),
    note: extractNote(body),
    items: parseItems(body),
  };
  count++;
}
console.log("main badges", count);

// Instructor shared requirements from page 137
const instructorBodyMatch = text.match(
  /除風帆外，各教導組專章之考驗應依下列程序辦理：([\s\S]*?)(?=風帆教導組專章內容如下：)/
);
const sailBodyMatch = text.match(
  /風帆教導組專章內容如下：([\s\S]*?)(?=-- 137 of 192 --|海上活動徽章)/
);

const instructorDefaultItems = instructorBodyMatch
  ? parseItems(`完成下列各項：${instructorBodyMatch[1]}`)
  : [
      {
        id: "item-1",
        title: "1. 在考獲某項專科徽章的三個月後，始可申請報考教導組之該項專章。",
        details: [],
      },
      {
        id: "item-2",
        title: "2. 對該專章之需求及施訓方法有足夠之認識，俾能教授童軍。",
        details: [],
      },
      {
        id: "item-3",
        title:
          "3. 指導最少一名童軍，協助其能在適當時間（通常為三個月）內考取相應之專章。",
        details: [],
      },
    ];

const sailItems = sailBodyMatch
  ? parseItems(`完成下列各項：${sailBodyMatch[1].replace(/^風帆\n/, "")}`)
  : [];

const instructorNames = [
  ["單車", "interest"],
  ["攝影", "interest"],
  ["風帆", "interest"],
  ["游泳", "interest"],
  ["露營", "skill"],
  ["通訊", "skill"],
  ["烹飪（中式）", "skill"],
  ["地圖繪製", "skill"],
  ["天象", "skill"],
  ["機械", "skill"],
  ["原野烹飪", "skill"],
  ["氣象", "skill"],
  ["觀察", "skill"],
  ["野外定向", "skill"],
  ["先鋒工程", "skill"],
  ["樹木護理", "skill"],
  ["護養", "service"],
  ["拯溺", "service"],
];

for (const [name, relatedGroup] of instructorNames) {
  const key = `instructor:${name}`;
  const relatedKey = `${relatedGroup}:${name}`;
  const isSail = name === "風帆";
  badges[key] = {
    key,
    name,
    englishName: badges[relatedKey]?.englishName || "",
    group: "instructor",
    category: "教導組",
    intro: isSail ? "風帆教導組專章內容" : "除風帆外，各教導組專章之考驗應依下列程序辦理",
    note: "",
    items: isSail && sailItems.length ? sailItems : instructorDefaultItems,
    relatedKey: badges[relatedKey] ? relatedKey : null,
  };
}

// Other awards: parse by English title after page 156
const otherDefs = [
  { name: "服務獎章", en: "Service Flash", next: "Leadership Award" },
  { name: "領導才獎章", en: "Leadership Award", next: "Patrol Activity Woggle" },
  { name: "小隊活動巾圈", en: "Patrol Activity Woggle", next: "Community Involvement Badge" },
  { name: "社區參與章", en: "Community Involvement Badge", next: "Religious Badge" },
  { name: "宗教章", en: "Religious Badge", next: "World Conservation Badge" },
  { name: "維護自然世界章", en: "World Conservation Badge", next: "World Scout\\s*Environment Badge" },
  { name: "世界童軍環境章", en: "World Scout\\s*Environment Badge", next: "Venture Scout\\s*Link Badge" },
  { name: "深資童軍先修章", en: "Venture Scout\\s*Link Badge", next: "The Hong Kong Award For Young People" },
];

const otherRegionStart = text.indexOf("-- 156 of 192 --");
const otherRegion = text.slice(otherRegionStart >= 0 ? otherRegionStart : 0);

for (const def of otherDefs) {
  const re = new RegExp(`${def.en}([\\s\\S]*?)(?=${def.next})`, "i");
  const m = otherRegion.match(re);
  if (!m) {
    console.log("other missing", def.name);
    continue;
  }
  const body = m[1];
  const key = `other:${def.name}`;
  badges[key] = {
    key,
    name: def.name,
    englishName: def.en.replace(/\\s\*/g, " "),
    group: "other",
    category: "其他獎章及徽章",
    intro: extractIntro(body),
    note: extractNote(body),
    items: parseItems(body),
  };
}

// Fallback: Service Flash (PDF title spacing can break English match)
if (!badges["other:服務獎章"]) {
  const flashBody = `完成下列各項：
1. 考獲童軍標準獎章或以上之進度性獎章。
2. 獲取兩個服務組之專章，亦可以一興趣組或技能組之專章代替其中之一個服務章，但該章之內容必須是一種有服務性質，而你亦有參加該項經常性之服務，例如圖書管理。
3. 考獲一教導組之專章或服務組專章中之急救、消防或拯溺其中之一，但此章不能計算在第二項內。
4. 參與一個為期三個月以上之服務，一般標準的需求為每星期一小時。
完成此章而當中包括不少於十五小時的服務，可與香港青年獎勵計劃銅章級服務科之相應項目對等。`;
  badges["other:服務獎章"] = {
    key: "other:服務獎章",
    name: "服務獎章",
    englishName: "Service Flash",
    group: "other",
    category: "其他獎章及徽章",
    intro: extractIntro(flashBody),
    note: extractNote(flashBody),
    items: parseItems(flashBody),
  };
}

const outPath = path.join(__dirname, "..", "data", "specialty-syllabus.json");
fs.writeFileSync(
  outPath,
  JSON.stringify({ generatedFrom: "FullVersion-zh.pdf", badges }, null, 2) + "\n",
  "utf8"
);

console.log("total", Object.keys(badges).length);
for (const n of [
  "interest:游泳",
  "interest:營地烹飪",
  "interest:藝術",
  "interest:釣魚",
  "skill:露營",
  "service:急救",
  "instructor:露營",
  "other:服務獎章",
  "other:世界童軍環境章",
]) {
  const b = badges[n];
  console.log(n, b ? `items=${b.items.length}` : "MISSING");
  if (b) {
    console.log(" ", b.items.map((x) => x.title).join(" | "));
  }
}
