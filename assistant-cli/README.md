# assistant-cli

命令行 AI 助手：摄入联系人/日记/知识文本，存 MySQL + Milvus，用 RAG + 记忆摘要回答问题。

## 功能

- **ingest**：把非结构化文本交给 LLM 做结构化抽取（联系人 / 日记 / 知识），写入 MySQL，并把可检索内容向量化写入 Milvus。
- **ask**：根据问题做 MySQL 精确查询（姓名/电话/日期）+ Milvus 语义检索，结合历史对话与记忆摘要，由 LLM 生成回答。

## 前置条件

- Node.js（ESM）
- MySQL（表结构见 `src/mysql/schema.sql`）
- Milvus（向量库）
- OpenAI 兼容 API（API Key、Base URL、模型名、Embedding 模型名）

## 安装

```bash
cd assistant-cli
npm install
```

## 配置

复制环境变量模板并填写：

```bash
cp .env.example .env
```

必填/常用变量见 `.env.example`：

| 类别     | 变量 |
|----------|------|
| LLM      | `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `MODEL_NAME`, `EMBEDDINGS_MODEL_NAME` |
| MySQL    | `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` |
| Milvus   | `MILVUS_ADDRESS` |
| 记忆     | `MEMORY_FILE`, `MEMORY_MAX_TOKENS`, `MEMORY_KEEP_TOKENS`（可选） |

首次使用前在 MySQL 中执行 `src/mysql/schema.sql` 建表。

## 用法

```bash
# 摄入：联系人 / 日记 / 知识
node src/cli.mjs ingest --type contact --text "张三，某某公司，CTO，电话 13800138000"
node src/cli.mjs ingest --type diary --text "2024-01-15 今天开会讨论了新项目"
node src/cli.mjs ingest --type kb --text "标题：项目规范\n内容：代码必须通过 lint..."

# 提问（会查 MySQL + Milvus + 历史记忆）
node src/cli.mjs ask --q "13800138000 是谁？"
node src/cli.mjs ask --q "1 月 15 号我记了什么？"
```

## 测试

```bash
npm test
```

会依次执行：config、schemas、milvus-client、llm、ingest、ask、smoke。运行前需配置好 `.env` 且 MySQL、Milvus 可用。

## 技术栈

- Node.js (ESM)、LangChain、Zod
- MySQL（mysql2）、Milvus（@zilliz/milvus2-sdk-node）
- js-tiktoken（Token 计数）、dotenv

## 文档

- `docs/2026-02-05-ai-assistant-cli.md`：实现与任务说明
- `docs/verify.md`：验证步骤
