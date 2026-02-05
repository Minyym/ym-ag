import { parseAndInsert } from "./ingest/ingest.mjs";
import { answerQuestion } from "./ask/ask.mjs";

function getArg(argv, name) {
  const idx = argv.indexOf(name);
  if (idx === -1) return null;
  return argv[idx + 1] || null;
}

export async function runCli(argv = process.argv.slice(2)) {
  const command = argv[0];
  if (!command) {
    console.log("用法: node src/cli.mjs <ingest|ask> [参数]");
    process.exit(1);
  }

  if (command === "ingest") {
    const type = getArg(argv, "--type");
    const text = getArg(argv, "--text");
    if (!type || !text) {
      console.log("用法: node src/cli.mjs ingest --type <contact|diary|kb> --text \"...\"");
      process.exit(1);
    }
    const result = await parseAndInsert(type, text);
    console.log(`✅ 已写入: ${result.type}，ID=${result.id}`);
    return;
  }

  if (command === "ask") {
    const q = getArg(argv, "--q");
    if (!q) {
      console.log("用法: node src/cli.mjs ask --q \"你的问题\"");
      process.exit(1);
    }
    const answer = await answerQuestion(q);
    console.log(answer);
    return;
  }

  console.log(`未知命令: ${command}`);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((err) => {
    console.error("执行失败:", err.message);
    process.exit(1);
  });
}
