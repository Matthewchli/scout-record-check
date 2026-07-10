const fs = require("fs");
const path = require("path");

const membersPath = path.join(__dirname, "..", "data", "members.json");
const data = JSON.parse(fs.readFileSync(membersPath, "utf8"));

const demoMeta = {
  2025000101: {
    游泳章: {
      activityName: "游泳專科徽章考核",
      organizer: "新界東第42旅童軍團",
      assessmentDate: "2025-07-22",
      examiner: "李領袖",
      syllabusKey: "interest:游泳",
    },
    營地烹飪章: {
      activityName: "營地烹飪專科徽章考核",
      organizer: "新界東第42旅童軍團",
      assessmentDate: "2025-03-15",
      examiner: "王領袖",
      syllabusKey: "interest:營地烹飪",
    },
    露營章: {
      activityName: "露營專科徽章考核",
      organizer: "新界東地域專章秘書",
      assessmentDate: "2024-08-10",
      examiner: "張領袖",
      syllabusKey: "skill:露營",
    },
    急救章: {
      activityName: "急救專科徽章考核",
      organizer: "香港聖約翰救護機構",
      assessmentDate: "2024-01-20",
      examiner: "陳主考",
      syllabusKey: "service:急救",
    },
    "露營章（教導組）": {
      activityName: "露營教導組專科徽章考核",
      organizer: "新界東地域專章秘書",
      assessmentDate: "2025-11-08",
      examiner: "張領袖",
      syllabusKey: "instructor:露營",
    },
    服務獎章: {
      activityName: "服務獎章考核",
      organizer: "新界東第42旅童軍團",
      assessmentDate: "2025-06-30",
      examiner: "李領袖",
      syllabusKey: "other:服務獎章",
    },
  },
  2025000102: {
    藝術章: {
      activityName: "藝術專科徽章考核",
      organizer: "新界東第42旅童軍團",
      assessmentDate: "2025-09-05",
      examiner: "王領袖",
      syllabusKey: "interest:藝術",
    },
    急救章: {
      activityName: "急救專科徽章考核",
      organizer: "香港紅十字會",
      assessmentDate: "2025-02-14",
      examiner: "黃主考",
      syllabusKey: "service:急救",
    },
    世界童軍環境章: {
      activityName: "世界童軍環境教育訓練班",
      organizer: "香港童軍總會",
      assessmentDate: "2026-04-05",
      examiner: "林主考",
      syllabusKey: "other:世界童軍環境章",
    },
  },
  2025000103: {
    釣魚章: {
      activityName: "釣魚專科徽章考核",
      organizer: "新界東第42旅童軍團",
      assessmentDate: "2026-01-25",
      examiner: "李領袖",
      syllabusKey: "interest:釣魚",
    },
  },
};

for (const member of data.members) {
  for (const badge of member.specialtyBadges || []) {
    if ("result" in badge) delete badge.result;
    const metaMap = demoMeta[member.scoutId];
    if (!metaMap) continue;
    const meta = metaMap[badge.name];
    if (!meta) continue;
    Object.assign(badge, meta);
    if (!badge.earnedDate && meta.assessmentDate) {
      badge.earnedDate = meta.assessmentDate;
    }
  }
}

fs.writeFileSync(membersPath, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log("updated: 成績 -> 主考");
