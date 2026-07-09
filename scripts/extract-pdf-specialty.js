const fs = require("fs");
const path = require("path");
const { PDFParse } = require("pdf-parse");

const pdfPath = "c:\\Users\\heiin\\Desktop\\童軍管理平台\\FullVersion-zh.pdf";
const outDir = path.join(__dirname, "..", "tmp");
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const buf = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buf });
  const result = await parser.getText();
  const text = result.text || "";
  fs.writeFileSync(path.join(outDir, "pdf-full.txt"), text, "utf8");
  console.log("chars", text.length);

  const markers = [
    "童軍專科徽章（興趣組）",
    "童軍專科徽章（技能組）",
    "童軍專科徽章（服務組）",
    "童軍專科徽章（教導組）",
    "其他獎章及徽章",
    "童軍專科徽章",
    "興趣組",
    "技能組",
    "服務組",
    "教導組",
  ];
  for (const m of markers) {
    console.log(m, text.indexOf(m));
  }

  // Prefer content after progressive section
  const startCandidates = [
    text.indexOf("童軍專科徽章（興趣組）"),
    text.indexOf("專科徽章（興趣組）"),
    text.lastIndexOf("興趣組"),
  ].filter((i) => i >= 0);
  const start = Math.min(...startCandidates);
  const slice = text.slice(start, start + 120000);
  fs.writeFileSync(path.join(outDir, "specialty-slice.txt"), slice, "utf8");
  console.log("slice start", start, "len", slice.length);
  console.log(slice.slice(0, 2500));
  await parser.destroy();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
