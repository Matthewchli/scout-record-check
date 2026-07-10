const fs = require("fs");
const path = require("path");

const electiveNote =
  "成員只需在戶外活動／海上活動／航空活動選取其中一項為主要考核項目，而各進度性獎章的選項均須相同。惟海童軍必須選擇「海上活動」；空童軍必須選擇「航空活動」。";

function item(id, title, details = []) {
  return { id, title, details };
}

const syllabus = {
  discovery: {
    key: "discovery",
    name: "探索獎章",
    fullName: "童軍探索獎章",
    englishName: "Scout Pathfinder Award",
    icon: "assets/badge-discovery.png",
    eligibility: "適合年滿十一歲而考獲會員章之童軍成員。",
    note: electiveNote,
    sections: [
      {
        id: "outdoor",
        code: "A",
        title: "戶外挑戰",
        subsections: [
          {
            id: "camping",
            title: "1. 營藝",
            items: [
              item("d-a-1a", "a. 參與一次露營活動", [
                "參與一次小隊、團或旅的露營活動，學習與小隊隊員相處及分工合作",
              ]),
              item("d-a-1b", "b. 收拾一個兩日一夜露營用的背囊", [
                "指出兩日一夜露營所需的個人物資及數量",
                "運用收拾背囊的原則，收拾一個露營用背囊",
              ]),
              item("d-a-1c", "c. 安全使用有潛在危險之工具", [
                "安全地使用有潛在危險之工具，例如營燈、爐具、手鎚及小刀等",
                "指出使用有關工具時應採取之安全措施",
              ]),
              item("d-a-1d", "d. 保養露營物品", [
                "清潔、整理及存放個人及小隊露營物品",
              ]),
            ],
          },
          {
            id: "adventure",
            title: "2. 歷險",
            items: [
              item("d-a-2a", "a. 參與一次郊野旅程", [
                "與小隊隊員進行不少於八公里徒步或不少於十二公里單車／船艇之郊野旅程",
              ]),
              item("d-a-2b", "b. 認識地圖及習用圖例", [
                "分辨地圖的種類及用途",
                "指出地圖內標示的十種習用圖例",
              ]),
              item("d-a-2c", "c. 收拾一個一日郊野旅程用的背囊", [
                "指出一日郊野旅程所需的個人物資及數量",
                "運用收拾背囊的原則，收拾一個郊野旅程用背囊",
              ]),
            ],
          },
          {
            id: "pioneer",
            title: "3. 先鋒工程",
            items: [
              item("d-a-3a", "a. 示範及指出所列繩結之結法及用途", [
                "包括平結、八字結、雙套結、半結、反手結、稱人結、接繩結、繫木結、縮繩結及曳木結",
              ]),
              item("d-a-3b", "b. 認識如何保養繩索", [
                "示範收繩的方法及技巧",
                "指出妥善收藏繩索的重要性",
              ]),
            ],
          },
          {
            id: "outdoor-elective",
            title: "4. 戶外活動（選修項目）",
            electiveGroup: "activity-track",
            items: [
              item("d-a-4a", "a. 明瞭戶外活動安全指引及郊野守則"),
              item("d-a-4b", "b. 完成下列其中一項戶外活動：", [
                "I. 參與一次追蹤符號應用之活動",
                "II. 參與一次公園定向活動",
                "III. 參與一次使用密碼通訊之活動",
              ]),
            ],
          },
          {
            id: "sea-elective",
            title: "5. 海上活動（選修項目）",
            electiveGroup: "activity-track",
            items: [
              item("d-a-5a", "a. 明瞭海上活動安全守則"),
              item("d-a-5b", "b. 通過本會之游泳測試"),
            ],
          },
          {
            id: "air-elective",
            title: "6. 航空活動（選修項目）",
            electiveGroup: "activity-track",
            items: [
              item("d-a-6a", "a. 能指出旅客在機場及航機內一般航空安全守則"),
              item("d-a-6b", "b. 完成下列其中一項：", [
                "I. 參與一個與航空有關的戶外活動",
                "II. 說出現代飛機〈包括定翼機、直昇機和軍用機〉的各主要部份及名稱",
                "III. 懂得基本航機辨認方法及能辨認初級航空章課程內的四種飛行器",
              ]),
            ],
          },
        ],
      },
      {
        id: "personal",
        code: "B",
        title: "個人發展",
        subsections: [
          {
            id: "fitness",
            title: "1. 體適能",
            items: [
              item("d-b-1a", "a. 參與一次以運動或體能競技為主題的小隊活動"),
            ],
          },
          {
            id: "arts",
            title: "2. 藝術、創意及科技",
            items: [
              item("d-b-2a", "a. 認識小隊歡呼", [
                "認識所屬小隊的歡呼，並於活動中吶喊以增強小隊士氣",
              ]),
            ],
          },
          {
            id: "leadership",
            title: "3. 領導才",
            items: [
              item("d-b-3a", "a. 參與一次小隊會議", [
                "參與一次小隊會議及指出召開小隊會議的目的",
              ]),
            ],
          },
          {
            id: "spiritual",
            title: "4. 靈性發展",
            items: [
              item(
                "d-b-4a",
                "a. 分享在日常生活中運用童軍誓詞、規律及銘言的例子"
              ),
              item("d-b-4b", "b. 參與一次默禱儀式"),
            ],
          },
        ],
      },
      {
        id: "society",
        code: "C",
        title: "社會",
        subsections: [
          {
            id: "service",
            title: "1. 服務他人",
            items: [
              item(
                "d-c-1a",
                "a. 示範如何處理流鼻血、燒傷、燙傷、割傷及刺傷等意外事件",
                [
                  "指出意外事件的成因及處理的先後次序",
                  "示範處理意外事件的方法",
                ]
              ),
              item("d-c-1b", "b. 完成不少於四小時服務", [
                "參與由總會、地域、童軍區或旅團認許之服務",
                "簡單記錄有關服務內容，並與小隊隊員分享經歷及感受",
              ]),
            ],
          },
          {
            id: "community",
            title: "2. 社區及本土認識",
            items: [
              item("d-c-2a", "a. 介紹社區設施", [
                "利用城市追蹤、圖片、相片、繪圖、街道圖、電子地圖或其他形式，向小隊隊員介紹居所或旅部附近的社區設施",
              ]),
            ],
          },
        ],
      },
      {
        id: "environment",
        code: "D",
        title: "環境",
        subsections: [
          {
            id: "ecology",
            title: "1. 生態環境",
            items: [
              item("d-d-1a", "a. 參觀一個以自然生境或生態為主題的展覽或地方", [
                "例如米埔自然保護區、西貢海下灣海岸公園、濕地公園、有機農場或自然教育徑等",
              ]),
            ],
          },
          {
            id: "weather",
            title: "2. 氣象",
            items: [
              item(
                "d-d-2a",
                "a. 認識天氣與氣候之別，並列舉天氣及氣候對戶外活動的影響",
                [
                  "指出天氣與氣候的分別，以及簡介香港的氣候",
                  "就各種天氣要素指出不同天氣情況對童軍活動的影響",
                ]
              ),
            ],
          },
        ],
      },
    ],
  },
  standard: {
    key: "standard",
    name: "標準獎章",
    fullName: "童軍標準獎章",
    englishName: "Scout Standard Award",
    icon: "assets/badge-standard.png",
    eligibility:
      "適合已完成童軍探索獎章，或年滿十三歲而考獲會員章，及童軍探索獎章內「戶外挑戰」項目之童軍成員。",
    note: electiveNote,
    sections: [
      {
        id: "outdoor",
        code: "A",
        title: "戶外挑戰",
        subsections: [
          {
            id: "camping",
            title: "1. 營藝",
            items: [
              item("s-a-1a", "a. 參與及記錄一次露營活動", [
                "參與一次小隊、團或旅的露營活動",
                "以編寫文字、演講、拍攝短片／相片或其他形式分享露營活動",
              ]),
              item("s-a-1b", "b. 架搭、收拾及存放營幕", [
                "認識不同營幕的種類，例如屋營、蒙古營",
                "示範架搭、收拾及妥善存放一個營幕",
              ]),
              item("s-a-1c", "c. 完成不少於四項營地建設", [
                "在露營活動中與小隊隊員合作完成不少於四項營地建設",
              ]),
              item("s-a-1d", "d. 示範利用天然物品及火柴在戶外生火", [
                "指出火的形成元素",
                "指出可作為燃料的天然物品",
                "示範搭建一個柴架及進行生火",
                "能夠將器皿內的水加熱至沸騰",
              ]),
              item("s-a-1e", "e. 認識及體驗在戶外烹調", [
                "烹調一簡單之膳食及熱飲",
                "處理膳後工作",
              ]),
            ],
          },
          {
            id: "adventure",
            title: "2. 歷險",
            items: [
              item("s-a-2a", "a. 參與及記錄一次郊野旅程", [
                "完成一次不少於十二公里徒步或不少於十八公里單車／船艇之郊野旅程",
                "以編寫文字、演講、拍攝短片／相片或其他形式分享旅程經歷",
              ]),
              item("s-a-2b", "b. 認識比例及距離", [
                "指出兩種地圖所使用的比例",
                "指出比例與距離的關係",
                "示範換算實際距離與地圖距離",
              ]),
              item("s-a-2c", "c. 示範正置地圖", [
                "指出正置地圖的方法及目的",
                "在郊野中利用地形、地貌與地徵及指南針示範正置地圖的方法",
              ]),
              item("s-a-2d", "d. 利用指南針及地圖尋找自己的位置", [
                "認識圖北、磁北、正北及坐標系統",
                "示範利用指南針及地圖尋找自己的位置",
                "示範以四位及六位方格座標標示自己的位置",
              ]),
            ],
          },
          {
            id: "pioneer",
            title: "3. 先鋒工程",
            items: [
              item("s-a-3a", "a. 示範及指出所列編結之結法及用途", [
                "包括四方編結、十字編結、八字編結、圓周編結及展立編結",
              ]),
              item("s-a-3b", "b. 遵守先鋒工程的安全守則", [
                "指出及遵守在先鋒工程活動進行時應有之安全守則",
              ]),
              item("s-a-3c", "c. 運用結、索及編結進行一項先鋒工程活動", [
                "製作及利用其進行一項活動",
              ]),
            ],
          },
          {
            id: "outdoor-elective",
            title: "4. 戶外活動（選修項目）",
            electiveGroup: "activity-track",
            items: [
              item("s-a-4a", "a. 完成童軍探索獎章戶外活動部分"),
              item("s-a-4b", "b. 考獲一個從未在過往獎章獲得，並與戶外活動有關之專科徽章"),
              item("s-a-4c", "c. 完成下列其中一項從未在過往獎章參與之戶外活動：", [
                "I. 參與一次城市追蹤活動",
                "II. 參與一次使用密碼、旗號或相類似形式之通訊活動",
              ]),
            ],
          },
          {
            id: "sea-elective",
            title: "5. 海上活動（選修項目）",
            electiveGroup: "activity-track",
            items: [
              item("s-a-5a", "a. 完成童軍探索獎章海上活動部分"),
              item("s-a-5b", "b. 考獲艇工章"),
              item("s-a-5c", "c. 於本會海上活動中心，參與一次童軍標準艇以外之海上活動"),
            ],
          },
          {
            id: "air-elective",
            title: "6. 航空活動（選修項目）",
            electiveGroup: "activity-track",
            items: [
              item("s-a-6a", "a. 完成童軍探索獎章航空活動部分"),
              item("s-a-6b", "b. 考獲初級航空活動章"),
              item("s-a-6c", "c. 完成下列其中一項：", [
                "I. 明瞭風如何影響飛行活動",
                "II. 認識與飛行安全相關的航空法例",
              ]),
            ],
          },
        ],
      },
      {
        id: "personal",
        code: "B",
        title: "個人發展",
        subsections: [
          {
            id: "fitness",
            title: "1. 體適能",
            items: [
              item("s-b-1a", "a. 完成下列其中一項：", [
                "I. 考獲一個從未在過往獎章獲得，並與體適能有關之專科徽章",
                "II. 設計及烹調一份正餐食譜",
              ]),
            ],
          },
          {
            id: "arts",
            title: "2. 藝術、創意及科技",
            items: [
              item("s-b-2a", "a. 參與一次營火會或營燈會活動"),
              item("s-b-2b", "b. 完成下列其中一項：", [
                "I. 考獲一個從未在過往獎章獲得，並與藝術或創意有關之專科徽章",
                "II. 欣賞一個藝術表演節目",
                "III. 參觀一個藝術品展覽",
                "IV. 表演一首小隊歌",
                "V. 參觀一個科技展覽",
                "VI. 製作一個電子小工具",
              ]),
            ],
          },
          {
            id: "leadership",
            title: "3. 領導才",
            items: [
              item("s-b-3a", "a. 參與一次小隊活動", [
                "參與一次小隊戶內或戶外活動",
              ]),
            ],
          },
          {
            id: "spiritual",
            title: "4. 靈性發展",
            items: [
              item("s-b-4a", "a. 參與一次童軍崇拜會"),
              item("s-b-4b", "b. 完成下列其中一項：", [
                "I. 介紹一個宗教",
                "II. 分享一個信念",
              ]),
            ],
          },
        ],
      },
      {
        id: "society",
        code: "C",
        title: "社會",
        subsections: [
          {
            id: "service",
            title: "1. 服務他人",
            items: [
              item(
                "s-c-1a",
                "a. 示範在意外發生時，如何迅速進行基本檢查及召喚緊急服務",
                ["認識急救的原則及緊急事故的處理方法"]
              ),
              item("s-c-1b", "b. 收拾一個適合一日戶外活動用的個人急救藥囊", [
                "認識如何應用藥囊內之各項用品",
              ]),
              item("s-c-1c", "c. 認識社區參與活動", [
                "指出社區參與活動的目的及重要性",
                "就居所或旅部的社區指出社區需要及可策劃之社區參與活動",
              ]),
              item("s-c-1d", "d. 參與共不少於八小時服務", [
                "參與由總會、地域、童軍區或旅團認許之服務",
                "簡單記錄有關服務內容",
              ]),
            ],
          },
          {
            id: "community",
            title: "2. 社區及本土認識",
            items: [
              item(
                "s-c-2a",
                "a. 參與或觀賞一個本地的文化習俗或傳統節慶活動"
              ),
            ],
          },
          {
            id: "world",
            title: "3. 世界認識",
            items: [
              item("s-c-3a", "a. 介紹一種外地的活動或文化", [
                "學習一種外地活動或文化，並與小隊隊員分享",
              ]),
            ],
          },
        ],
      },
      {
        id: "environment",
        code: "D",
        title: "環境",
        subsections: [
          {
            id: "ecology",
            title: "1. 生態環境",
            items: [
              item("s-d-1a", "a. 介紹生物鏈、生物網及物種生態循環", [
                "以繪畫、製作電子多媒體或其他形式介紹",
              ]),
            ],
          },
          {
            id: "weather",
            title: "2. 氣象",
            items: [
              item("s-d-2a", "a. 完成下列其中一項：", [
                "I. 介紹風速及風向的量度方法",
                "II. 介紹雲的形成過程及十種基本雲層的種類",
              ]),
            ],
          },
          {
            id: "crisis",
            title: "3. 危機及保護",
            items: [
              item("s-d-3a", "a. 完成下列其中一項：", [
                "I. 介紹自然災難對環境的影響",
                'II. 認識「不留痕」(Leave No Trace)',
              ]),
            ],
          },
        ],
      },
      {
        id: "experience",
        code: "E",
        title: "新體驗",
        subsections: [
          {
            id: "exchange",
            title: "1. 參與一次交流活動",
            items: [
              item(
                "s-e-1a",
                "a. 以童軍身份參與一次與其他旅團或團體的交流活動"
              ),
            ],
          },
        ],
      },
    ],
  },
  advanced: {
    key: "advanced",
    name: "高級獎章",
    fullName: "童軍高級獎章",
    englishName: "Scout Advanced Award",
    icon: "assets/badge-advanced.png",
    eligibility:
      "適合已完成童軍標準獎章，或年滿十三歲而考獲會員章，童軍探索獎章及童軍標準獎章內「戶外挑戰」項目之童軍成員。",
    note: electiveNote,
    sections: [
      {
        id: "outdoor",
        code: "A",
        title: "戶外挑戰",
        subsections: [
          {
            id: "camping",
            title: "1. 營藝",
            items: [
              item(
                "a-a-1a",
                "a. 協助策劃及參與一次露營活動，並在活動中負責其中一個範疇的工作",
                [
                  "安排露營膳食，包括設計食譜、採購及烹調食材",
                  "管理營地衛生，包括執行及安排營地衛生工作",
                  "管理露營物資，包括準備及借還物資",
                ]
              ),
              item("a-a-1b", "b. 完成不少於六項營地建設"),
              item("a-a-1c", "c. 進行一次原野烹飪活動", [
                "利用天然物品及火柴生火並烹調食物",
              ]),
            ],
          },
          {
            id: "adventure",
            title: "2. 歷險",
            items: [
              item("a-a-2a", "a. 完成以下其中一項：", [
                "I. 進行一次兩日一夜之郊野旅程",
                "II. 參與策劃、進行及紀錄一次由黃昏至黎明之遠足旅程",
              ]),
              item("a-a-2b", "b. 認識等高線與地形的關係", [
                "能從等高線中識辨不同地形，例如山咀、山脊、山谷、山丘及懸崖等",
              ]),
              item(
                "a-a-2c",
                "c. 示範在沒有使用指南針的情況下辨別方向的技巧",
                ["使用太陽、星座、樹木生長情況等來辨別方向"]
              ),
            ],
          },
          {
            id: "pioneer",
            title: "3. 先鋒工程",
            items: [
              item("a-a-3a", "a. 示範及指出所列繩結之結法及用途", [
                "包括雙接繩結、漁翁結、三套結、勾口結、吊板結及普通繩端結",
              ]),
              item("a-a-3b", "b. 選擇、使用及保養適合先鋒工程之工具", [
                "例如繩、竹、棍、滑輪、鎚及釘等",
              ]),
              item("a-a-3c", "c. 運用不少於兩種編結製作兩項先鋒工程"),
            ],
          },
          {
            id: "outdoor-elective",
            title: "4. 戶外活動（選修項目）",
            electiveGroup: "activity-track",
            items: [
              item("a-a-4a", "a. 完成童軍標準獎章戶外活動部分"),
              item("a-a-4b", "b. 考獲以下其中兩個專科徽章", [
                "I. 露營（技能組）、探險（技能組）、先鋒工程（技能組）及原野烹飪（技能組）",
              ]),
            ],
          },
          {
            id: "sea-elective",
            title: "5. 海上活動（選修項目）",
            electiveGroup: "activity-track",
            items: [
              item("a-a-5a", "a. 完成童軍標準獎章海上活動部分"),
              item("a-a-5b", "b. 考獲水手章"),
              item("a-a-5c", "c. 考獲與海上活動有關之專科徽章"),
            ],
          },
          {
            id: "air-elective",
            title: "6. 航空活動（選修項目）",
            electiveGroup: "activity-track",
            items: [
              item("a-a-6a", "a. 完成童軍標準獎章航空活動部份"),
              item("a-a-6b", "b. 考獲中級航空活動章"),
              item("a-a-6c", "c. 認識簡單的航空氣象"),
            ],
          },
        ],
      },
      {
        id: "personal",
        code: "B",
        title: "個人發展",
        subsections: [
          {
            id: "fitness",
            title: "1. 體適能",
            items: [
              item("a-b-1a", "a. 完成下列其中一項：", [
                "I. 考獲一個從未在過往獎章獲得，並與體適能有關之專科徽章",
                "II. 執行及記錄一個為期四至六個星期的體能訓練",
                "III. 介紹人體生長和發育過程及不良嗜好對健康的影響",
                "IV. 宣傳一個有關健康生活的主題",
              ]),
            ],
          },
          {
            id: "arts",
            title: "2. 藝術、創意及科技",
            items: [
              item(
                "a-b-2a",
                "a. 考獲一個從未在過往獎章獲得，並與藝術、創意或科技有關之專科徽章"
              ),
              item("a-b-2b", "b. 完成下列其中一項：", [
                "I. 表演一個節目",
                "II. 製作一件藝術品",
                "III. 創作及表演一首小隊歌",
                "IV. 製作一個模型",
                "V. 利用資訊科技宣傳小隊、團或旅活動",
                "VI. 製作一個電動機械動物或昆蟲或相類似之電動機械模型",
              ]),
            ],
          },
          {
            id: "leadership",
            title: "3. 領導才",
            items: [
              item("a-b-3a", "a. 執行小隊長會議之議決案", [
                "出席最少一次小隊長會議及負責執行其中一項議決案",
              ]),
            ],
          },
          {
            id: "spiritual",
            title: "4. 靈性發展",
            items: [
              item("a-b-4a", "a. 擔任及履行一小隊或旅團職務不少於三個月"),
              item("a-b-4b", "b. 完成下列其中一項：", [
                "I. 參與一個宗教／靈性發展活動",
                "II. 分享個人宗教信仰",
              ]),
            ],
          },
        ],
      },
      {
        id: "society",
        code: "C",
        title: "社會",
        subsections: [
          {
            id: "service",
            title: "1. 服務他人",
            items: [
              item(
                "a-c-1a",
                "a. 收拾一個適合兩日一夜戶外活動用的小隊急救藥囊"
              ),
              item(
                "a-c-1b",
                "b. 示範如何處理創傷、出血、中暑及熱衰竭之情況"
              ),
              item("a-c-1c", "c. 認識如何策劃社區參與活動", [
                "指出策劃程序、步驟、時間規劃及分工表",
              ]),
              item("a-c-1d", "d. 協助策劃及參與共不少於十二小時服務", [
                "當中有不少於一半的服務時數必須以童軍身份參與",
              ]),
            ],
          },
          {
            id: "community",
            title: "2. 社區及本土認識",
            items: [
              item("a-c-2a", "a. 完成下列其中一項：", [
                "I. 考獲一個與社區認識有關的專科徽章或獎章",
                "II. 介紹區議會及立法會之組織和功能",
                "III. 參與一次共融活動",
              ]),
            ],
          },
          {
            id: "world",
            title: "3. 世界認識",
            items: [
              item("a-c-3a", "a. 完成下列其中一項：", [
                "I. 介紹一個國際組織",
                "II. 介紹一個其他國家／地區的童軍組織",
              ]),
            ],
          },
        ],
      },
      {
        id: "environment",
        code: "D",
        title: "環境",
        subsections: [
          {
            id: "ecology",
            title: "1. 生態環境",
            items: [
              item(
                "a-d-1a",
                "a. 介紹香港生境、物種的分類、其多樣性及分佈，並舉出香港的瀕危物種及其面對的威脅"
              ),
            ],
          },
          {
            id: "weather",
            title: "2. 氣象",
            items: [
              item("a-d-2a", "a. 完成下列其中一項：", [
                "I. 介紹四季的成因",
                "II. 介紹廿四節氣",
              ]),
              item("a-d-2b", "b. 完成下列其中一項：", [
                "I. 介紹本港的氣候",
                "II. 介紹本港常用之天氣術語、警告定義及惡劣天氣應變措施",
              ]),
            ],
          },
          {
            id: "crisis",
            title: "3. 危機及保護",
            items: [
              item("a-d-3a", "a. 完成下列其中一項：", [
                'I. 介紹香港在「可持續發展」的工作',
                "II. 參與一個不少於一天或兩次的環境保育工作",
              ]),
            ],
          },
        ],
      },
      {
        id: "experience",
        code: "E",
        title: "新體驗",
        subsections: [
          {
            id: "new",
            title: "1. 參與一項從未嘗試之活動，並向團內其他成員介紹",
            items: [
              item(
                "a-e-1a",
                "a. 參與一項從未嘗試之活動，並向團內其他成員介紹"
              ),
            ],
          },
        ],
      },
    ],
  },
  chief: {
    key: "chief",
    name: "總領袖獎章",
    fullName: "總領袖獎章",
    englishName: "Chief Scout's Award",
    icon: "assets/badge-chief.png",
    eligibility:
      "適合已完成童軍高級獎章，或年滿十三歲而考獲會員章，童軍探索獎章、童軍標準獎章內「戶外挑戰」項目及童軍高級獎章之童軍成員。",
    note: electiveNote,
    sections: [
      {
        id: "outdoor",
        code: "A",
        title: "戶外挑戰",
        subsections: [
          {
            id: "camping",
            title: "1. 營藝",
            items: [
              item("c-a-1a", "a. 計劃及實行一次露營", [
                "製作露營計劃並按計劃進行小隊、團或旅露營",
              ]),
              item("c-a-1b", "b. 教授基本露營技巧", [
                "教授收拾露營背囊、架搭及收拾營幕、戶外烹調及營地紮作等",
              ]),
              item("c-a-1c", "c. 製作一個露營報告"),
            ],
          },
          {
            id: "adventure",
            title: "2. 歷險",
            items: [
              item(
                "c-a-2a",
                "a. 參與策劃、進行及記錄一次不少於兩日一夜之郊野旅程",
                [
                  "完成不少於三十公里徒步之郊野旅程，並製作完整計劃書及報告書",
                ]
              ),
              item("c-a-2b", "b. 教授基本郊野旅程技巧"),
              item("c-a-2c", "c. 示範野外基本求生技能", [
                "如淨化食水、收拾及使用殘存盒、發送求生訊號等",
              ]),
            ],
          },
          {
            id: "pioneer",
            title: "3. 先鋒工程",
            items: [
              item(
                "c-a-3a",
                "a. 計劃及帶領小隊完成一個應用不少於三種編結之先鋒工程",
                ["包括事前準備、事後收拾及先鋒工程計劃"]
              ),
              item("c-a-3b", "b. 教授基本先鋒工程技巧", [
                "教授繩結之結法與用途，及收繩的方法與技巧",
              ]),
            ],
          },
          {
            id: "outdoor-elective",
            title: "4. 戶外活動（選修項目）",
            electiveGroup: "activity-track",
            items: [
              item("c-a-4a", "a. 完成童軍高級獎章戶外活動部分"),
              item("c-a-4b", "b. 策劃和參與一個全日小隊戶外活動"),
            ],
          },
          {
            id: "sea-elective",
            title: "5. 海上活動（選修項目）",
            electiveGroup: "activity-track",
            items: [
              item("c-a-5a", "a. 完成童軍高級獎章海上活動部分"),
              item("c-a-5b", "b. 策劃及參與一個不少於六小時之海上旅程"),
            ],
          },
          {
            id: "air-elective",
            title: "6. 航空活動（選修項目）",
            electiveGroup: "activity-track",
            items: [
              item("c-a-6a", "a. 完成童軍高級獎章航空活動部份"),
              item("c-a-6b", "b. 於自選航空活動項目內選擇其中兩項從未進行過之項目"),
            ],
          },
        ],
      },
      {
        id: "personal",
        code: "B",
        title: "個人發展",
        subsections: [
          {
            id: "fitness",
            title: "1. 體適能",
            items: [
              item(
                "c-b-1a",
                "a. 考獲一個從未在過往獎章獲得，並與體適能有關之專科徽章"
              ),
              item(
                "c-b-1b",
                "b. 計劃及執行一次以運動或體能競技為主題的小隊活動"
              ),
            ],
          },
          {
            id: "arts",
            title: "2. 藝術、創意及科技",
            items: [
              item(
                "c-b-2a",
                "a. 創作及帶領一個營火會或營燈會歡呼、表演節目或遊戲"
              ),
              item("c-b-2b", "b. 完成下列其中一項：", [
                "I. 分享一件藝術品創作過程",
                "II. 教授製作一個模型",
                "III. 教授以資訊科技製作宣傳品",
                "IV. 教授製作一個以電池驅動的機械",
                "V. 建立電子地圖",
                "VI. 製作一個可操控之機械模型",
              ]),
            ],
          },
          {
            id: "leadership",
            title: "3. 領導才",
            items: [item("c-b-3a", "a. 考獲領導才獎章")],
          },
          {
            id: "spiritual",
            title: "4. 靈性發展",
            items: [
              item("c-b-4a", "a. 介紹童軍誓詞、規律及銘言", [
                "向新加入童軍介紹有關的內容和意義",
              ]),
              item("c-b-4b", "b. 完成下列其中一項：", [
                "I. 帶領一次默禱儀式",
                "II. 協助一次童軍崇拜會",
                "III. 考獲宗教章",
              ]),
            ],
          },
        ],
      },
      {
        id: "society",
        code: "C",
        title: "社會",
        subsections: [
          {
            id: "service",
            title: "1. 服務他人",
            items: [
              item("c-c-1a", "a. 考獲以下其中一個專科徽章", [
                "I. 急救（服務組）、消防（服務組）、拯溺（服務組）",
              ]),
              item("c-c-1b", "b. 探討社區參與活動", [
                "I. 參與或參觀該專題講座或展覽，了解其目的、內容及宣揚的信息",
              ]),
              item("c-c-1c", "c. 協助策劃及參與共不少於十六小時服務", [
                "不少於一半時數以童軍身份參與",
                "不少於一半時數服務對象為非童軍單位",
                "向團或公眾人士作簡短匯報",
              ]),
            ],
          },
          {
            id: "community",
            title: "2. 社區及本土認識",
            items: [
              item("c-c-2a", "a. 探討一個本地時事話題"),
              item("c-c-2b", "b. 完成下列其中一項：", [
                "I. 考獲旅遊（興趣組）專科徽章",
                "II. 學習與有特殊需要人士的溝通方法",
                "III. 調查社區設施及服務",
              ]),
            ],
          },
          {
            id: "world",
            title: "3. 世界認識",
            items: [
              item("c-c-3a", "a. 探討一個國際問題"),
              item("c-c-3b", "b. 完成下列其中一項：", [
                "I. 參加國際電訊日",
                "II. 介紹一位外地童軍朋友",
                "III. 參加一個與外地童軍交流的活動",
              ]),
            ],
          },
        ],
      },
      {
        id: "environment",
        code: "D",
        title: "環境",
        subsections: [
          {
            id: "ecology",
            title: "1. 生態環境",
            items: [
              item(
                "c-d-1a",
                "a. 考獲一個從未在過往獎章獲得，並與生態環境有關之專科徽章或獎章"
              ),
            ],
          },
          {
            id: "weather",
            title: "2. 氣象",
            items: [
              item("c-d-2a", "a. 教授一項氣象知識"),
              item("c-d-2b", "b. 完成下列其中一項：", [
                "I. 考獲氣象（興趣組）專科徽章",
                "II. 介紹天氣圖及記錄一個童軍營地自動氣象站的一週天氣",
              ]),
            ],
          },
          {
            id: "crisis",
            title: "3. 危機及保護",
            items: [
              item("c-d-3a", "a. 介紹人類活動對環境的影響"),
              item("c-d-3b", "b. 計劃及帶領一個環境保育工作"),
            ],
          },
        ],
      },
      {
        id: "experience",
        code: "E",
        title: "新體驗",
        subsections: [
          {
            id: "new",
            title: "新活動及教導",
            items: [
              item(
                "c-e-1a",
                "1. 參與一項從未嘗試之活動，並向團內其他成員介紹"
              ),
              item("c-e-2a", "2. 考獲一個教導組專科徽章"),
            ],
          },
        ],
      },
    ],
  },
};

function countItems(badge) {
  let n = 0;
  for (const s of badge.sections) {
    for (const sub of s.subsections) n += sub.items.length;
  }
  return n;
}

for (const [k, b] of Object.entries(syllabus)) {
  console.log(k, countItems(b));
}

const out = path.join(__dirname, "..", "data", "progressive-syllabus.json");
fs.writeFileSync(out, JSON.stringify(syllabus, null, 2), "utf8");
console.log("written", out);
