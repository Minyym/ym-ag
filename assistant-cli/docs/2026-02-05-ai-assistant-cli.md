# AI Assistant CLI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI that ingests contact/diary/knowledge text, stores facts in MySQL, vectors in Milvus, and answers questions with RAG + memory summarization.

**Architecture:** CLI exposes `ingest` and `ask`. `ingest` runs LLM structured extraction → MySQL insert, and writes searchable content → Milvus. `ask` runs MySQL exact lookup + Milvus semantic retrieval, then LLM answer; memory is truncated/summarized when over limits.

**Tech Stack:** Node.js (ESM), LangChain, Zod, MySQL (mysql2), Milvus SDK, js-tiktoken, dotenv.

---

### Task 1: Scaffold workspace and config

**Files:**
- Create: `assistant-cli/package.json`
- Create: `assistant-cli/.env.example`
- Create: `assistant-cli/src/config.mjs`

**Step 1: Write the failing test**

```js
// assistant-cli/src/__tests__/config.test.mjs
import assert from "node:assert/strict";
import { getConfig } from "../config.mjs";

assert.throws(() => getConfig(), /OPENAI_API_KEY/);
```

**Step 2: Run test to verify it fails**

Run: `node assistant-cli/src/__tests__/config.test.mjs`  
Expected: FAIL with "Cannot find module" or missing config export

**Step 3: Write minimal implementation**

```js
// assistant-cli/src/config.mjs
import "dotenv/config";

export function getConfig() {
  const required = ["OPENAI_API_KEY", "OPENAI_BASE_URL", "MODEL_NAME", "EMBEDDINGS_MODEL_NAME"];
  for (const key of required) {
    if (!process.env[key]) throw new Error(`${key} is required`);
  }
  return {
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiBaseUrl: process.env.OPENAI_BASE_URL,
    modelName: process.env.MODEL_NAME,
    embeddingsModel: process.env.EMBEDDINGS_MODEL_NAME,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `OPENAI_API_KEY=x OPENAI_BASE_URL=x MODEL_NAME=x EMBEDDINGS_MODEL_NAME=x node assistant-cli/src/__tests__/config.test.mjs`  
Expected: PASS (no output)

**Step 5: Commit**

```bash
git add assistant-cli/package.json assistant-cli/.env.example assistant-cli/src/config.mjs assistant-cli/src/__tests__/config.test.mjs
git commit -m "feat: add cli config scaffold"
```

---

### Task 2: Define schemas and MySQL tables

**Files:**
- Create: `assistant-cli/src/schemas.mjs`
- Create: `assistant-cli/src/mysql/schema.sql`
- Create: `assistant-cli/src/mysql/client.mjs`

**Step 1: Write the failing test**

```js
// assistant-cli/src/__tests__/schemas.test.mjs
import assert from "node:assert/strict";
import { contactSchema, diarySchema, kbSchema } from "../schemas.mjs";

assert.ok(contactSchema && diarySchema && kbSchema);
```

**Step 2: Run test to verify it fails**

Run: `node assistant-cli/src/__tests__/schemas.test.mjs`  
Expected: FAIL with "Cannot find module" or missing exports

**Step 3: Write minimal implementation**

```js
// assistant-cli/src/schemas.mjs
import { z } from "zod";

export const contactSchema = z.object({
  name: z.string(),
  gender: z.string().nullable(),
  birth_date: z.string().nullable(),
  company: z.string().nullable(),
  title: z.string().nullable(),
  phone: z.string().nullable(),
  wechat: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
});

export const diarySchema = z.object({
  date: z.string(),
  mood: z.string().nullable(),
  content: z.string(),
  tags: z.array(z.string()).nullable(),
});

export const kbSchema = z.object({
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()).nullable(),
});
```

**Step 4: Run test to verify it passes**

Run: `node assistant-cli/src/__tests__/schemas.test.mjs`  
Expected: PASS

**Step 5: Commit**

```bash
git add assistant-cli/src/schemas.mjs assistant-cli/src/mysql/schema.sql assistant-cli/src/mysql/client.mjs assistant-cli/src/__tests__/schemas.test.mjs
git commit -m "feat: add schemas and mysql bootstrap"
```

---

### Task 3: Milvus client and knowledge collection

**Files:**
- Create: `assistant-cli/src/milvus/client.mjs`
- Create: `assistant-cli/src/milvus/ensure-collection.mjs`

**Step 1: Write the failing test**

```js
// assistant-cli/src/__tests__/milvus-client.test.mjs
import assert from "node:assert/strict";
import { getMilvusClient } from "../milvus/client.mjs";
assert.ok(getMilvusClient);
```

**Step 2: Run test to verify it fails**

Run: `node assistant-cli/src/__tests__/milvus-client.test.mjs`  
Expected: FAIL with missing module/export

**Step 3: Write minimal implementation**

```js
// assistant-cli/src/milvus/client.mjs
import { MilvusClient } from "@zilliz/milvus2-sdk-node";
export function getMilvusClient() {
  return new MilvusClient({ address: "localhost:19530" });
}
```

**Step 4: Run test to verify it passes**

Run: `node assistant-cli/src/__tests__/milvus-client.test.mjs`  
Expected: PASS

**Step 5: Commit**

```bash
git add assistant-cli/src/milvus/client.mjs assistant-cli/src/milvus/ensure-collection.mjs assistant-cli/src/__tests__/milvus-client.test.mjs
git commit -m "feat: add milvus client scaffold"
```

---

### Task 4: Embeddings + LLM wrappers

**Files:**
- Create: `assistant-cli/src/llm/model.mjs`
- Create: `assistant-cli/src/llm/embeddings.mjs`

**Step 1: Write the failing test**

```js
// assistant-cli/src/__tests__/llm.test.mjs
import assert from "node:assert/strict";
import { getModel } from "../llm/model.mjs";
import { getEmbeddings } from "../llm/embeddings.mjs";
assert.ok(getModel && getEmbeddings);
```

**Step 2: Run test to verify it fails**

Run: `node assistant-cli/src/__tests__/llm.test.mjs`  
Expected: FAIL with missing exports

**Step 3: Write minimal implementation**

```js
// assistant-cli/src/llm/model.mjs
import { ChatOpenAI } from "@langchain/openai";
import { getConfig } from "../config.mjs";
export function getModel() {
  const cfg = getConfig();
  return new ChatOpenAI({
    modelName: cfg.modelName,
    apiKey: cfg.openaiApiKey,
    temperature: 0,
    configuration: { baseURL: cfg.openaiBaseUrl },
  });
}
```

**Step 4: Run test to verify it passes**

Run: `OPENAI_API_KEY=x OPENAI_BASE_URL=x MODEL_NAME=x EMBEDDINGS_MODEL_NAME=x node assistant-cli/src/__tests__/llm.test.mjs`  
Expected: PASS

**Step 5: Commit**

```bash
git add assistant-cli/src/llm/model.mjs assistant-cli/src/llm/embeddings.mjs assistant-cli/src/__tests__/llm.test.mjs
git commit -m "feat: add llm wrappers"
```

---

### Task 5: Ingest pipeline (contact/diary/kb)

**Files:**
- Create: `assistant-cli/src/ingest/ingest.mjs`
- Create: `assistant-cli/src/mysql/insert.mjs`
- Create: `assistant-cli/src/milvus/insert.mjs`

**Step 1: Write the failing test**

```js
// assistant-cli/src/__tests__/ingest.test.mjs
import assert from "node:assert/strict";
import { parseAndInsert } from "../ingest/ingest.mjs";
assert.ok(parseAndInsert);
```

**Step 2: Run test to verify it fails**

Run: `node assistant-cli/src/__tests__/ingest.test.mjs`  
Expected: FAIL

**Step 3: Write minimal implementation**

Implement `parseAndInsert(type, text)`:
- `type=contact|diary|kb`  
- 使用 `withStructuredOutput(schema)` 解析  
- 写 MySQL（contact/diary/kb）  
- 把可检索文本写入 Milvus `knowledge` collection  

**Step 4: Run test to verify it passes**

Run: `node assistant-cli/src/__tests__/ingest.test.mjs`  
Expected: PASS (只验证导出存在)

**Step 5: Commit**

```bash
git add assistant-cli/src/ingest/ingest.mjs assistant-cli/src/mysql/insert.mjs assistant-cli/src/milvus/insert.mjs assistant-cli/src/__tests__/ingest.test.mjs
git commit -m "feat: add ingest pipeline"
```

---

### Task 6: Ask pipeline (MySQL + Milvus + Memory)

**Files:**
- Create: `assistant-cli/src/ask/ask.mjs`
- Create: `assistant-cli/src/memory/memory.mjs`
- Create: `assistant-cli/src/mysql/query.mjs`
- Create: `assistant-cli/src/milvus/search.mjs`

**Step 1: Write the failing test**

```js
// assistant-cli/src/__tests__/ask.test.mjs
import assert from "node:assert/strict";
import { answerQuestion } from "../ask/ask.mjs";
assert.ok(answerQuestion);
```

**Step 2: Run test to verify it fails**

Run: `node assistant-cli/src/__tests__/ask.test.mjs`  
Expected: FAIL

**Step 3: Write minimal implementation**

Implement `answerQuestion(question)`:
- 精确查询 MySQL（按姓名/手机号/日期等关键词）  
- 语义检索 Milvus（topK=3）  
- 组 prompt（事实优先，RAG 补充）  
- Memory：超过阈值时总结 + 保留最近 N 条  

**Step 4: Run test to verify it passes**

Run: `node assistant-cli/src/__tests__/ask.test.mjs`  
Expected: PASS

**Step 5: Commit**

```bash
git add assistant-cli/src/ask/ask.mjs assistant-cli/src/memory/memory.mjs assistant-cli/src/mysql/query.mjs assistant-cli/src/milvus/search.mjs assistant-cli/src/__tests__/ask.test.mjs
git commit -m "feat: add ask pipeline"
```

---

### Task 7: CLI entry and smoke script

**Files:**
- Create: `assistant-cli/src/cli.mjs`
- Create: `assistant-cli/src/__tests__/smoke.mjs`

**Step 1: Write the failing test**

```js
// assistant-cli/src/__tests__/smoke.mjs
import assert from "node:assert/strict";
import { runCli } from "../cli.mjs";
assert.ok(runCli);
```

**Step 2: Run test to verify it fails**

Run: `node assistant-cli/src/__tests__/smoke.mjs`  
Expected: FAIL

**Step 3: Write minimal implementation**

Implement CLI commands:
- `node src/cli.mjs ingest --type contact --text "..."`  
- `node src/cli.mjs ask --q "..."`  

**Step 4: Run test to verify it passes**

Run: `node assistant-cli/src/__tests__/smoke.mjs`  
Expected: PASS

**Step 5: Commit**

```bash
git add assistant-cli/src/cli.mjs assistant-cli/src/__tests__/smoke.mjs
git commit -m "feat: add cli entry"
```

---

### Task 8: Manual verification checklist

**Files:**
- Create: `assistant-cli/docs/verify.md`

**Steps:**
1. 启动 Milvus：`docker compose -f milvus/milvus-standalone-docker-compose.yml up -d`  
2. 初始化 MySQL：执行 `assistant-cli/src/mysql/schema.sql`  
3. Ingest 联系人/日记/知识库各 2 条  
4. Ask 5 个问题，观察是否命中事实与语义  

**Commit**

```bash
git add assistant-cli/docs/verify.md
git commit -m "docs: add manual verification steps"
```

---

**Plan complete and saved to** `docs/plans/2026-02-05-ai-assistant-cli.md`.
