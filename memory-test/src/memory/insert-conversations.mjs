/**
 * insert-conversations.mjs
 *
 * 作用：把「对话文本」转成向量，写入 Milvus，供后续 RAG 检索用。
 * 流程：连接 Milvus → 建表（集合）→ 建向量索引 → 加载集合 → 对每条对话调 embedding API 得到向量 → 插入 Milvus。
 */

import "dotenv/config";
import {
  MilvusClient,
  DataType,
  MetricType,
  IndexType,
} from "@zilliz/milvus2-sdk-node";
import { OpenAIEmbeddings } from "@langchain/openai";

// 集合名（相当于表名）
const COLLECTION_NAME = "conversations";
// 向量维度，需与 embedding 模型输出一致（如 text-embedding-v3 常用 1024）
const VECTOR_DIM = 1024;

// 用 OpenAI 兼容 API 做文本向量化（可配阿里/DeepSeek 等 baseURL）
const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
  model: "text-embedding-v3",
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
  dimensions: VECTOR_DIM,
});

// Milvus 客户端，默认连本机 19530 端口
const client = new MilvusClient({
  address: "localhost:19530",
});

/**
 * 把一段文本转成 VECTOR_DIM 维的浮点向量，用于后续相似度检索
 */
async function getEmbedding(text) {
  const result = await embeddings.embedQuery(text);
  return result;
}

async function main() {
  try {
    console.log("连接到 Milvus...");
    await client.connectPromise;
    console.log("✓ 已连接\n");

    // ---------- 1. 创建集合（相当于建表） ----------
    console.log("创建集合...");
    await client.createCollection({
      collection_name: COLLECTION_NAME,
      fields: [
        { name: "id", data_type: DataType.VarChar, max_length: 50, is_primary_key: true },
        { name: "vector", data_type: DataType.FloatVector, dim: VECTOR_DIM }, // 存 embedding 向量
        { name: "content", data_type: DataType.VarChar, max_length: 5000 },   // 原始对话文本
        { name: "round", data_type: DataType.Int64 },                          // 第几轮对话
        { name: "timestamp", data_type: DataType.VarChar, max_length: 100 },  // 时间戳
      ],
    });
    console.log("✓ 集合已创建");

    // ---------- 2. 为 vector 字段建索引，才能做相似度搜索 ----------
    // IVF_FLAT：倒排+暴力，适合中小规模；COSINE：用余弦相似度
    console.log("\n创建索引...");
    await client.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: "vector",
      index_type: IndexType.IVF_FLAT,
      metric_type: MetricType.COSINE,
    });
    console.log("✓ 索引已创建");

    // ---------- 3. 加载到内存，之后才能查询/插入 ----------
    console.log("\n加载集合...");
    await client.loadCollection({ collection_name: COLLECTION_NAME });
    console.log("✓ 集合已加载");

    // ---------- 4. 准备对话数据并插入 ----------
    console.log("\n插入对话数据...");
    const conversations = [
      {
        id: "conv_001",
        content:
          "用户: 我叫赵六，是一名数据科学家\n助手: 很高兴认识你，赵六！数据科学是一个很有趣的领域。",
        round: 1,
        timestamp: new Date().toISOString(),
      },
      {
        id: "conv_002",
        content:
          "用户: 我最近在研究机器学习算法\n助手: 机器学习确实很有意思，你在研究哪些算法呢？",
        round: 2,
        timestamp: new Date().toISOString(),
      },
      {
        id: "conv_003",
        content:
          "用户: 我喜欢打篮球和看电影\n助手: 运动和文化娱乐都是很好的爱好！",
        round: 3,
        timestamp: new Date().toISOString(),
      },
      {
        id: "conv_004",
        content: "用户: 我周末经常去电影院\n助手: 看电影是很好的放松方式。",
        round: 4,
        timestamp: new Date().toISOString(),
      },
      {
        id: "conv_005",
        content:
          "用户: 我的职业是软件工程师\n助手: 软件工程师是个很有前景的职业！",
        round: 5,
        timestamp: new Date().toISOString(),
      },
    ];

    // 对每条对话的 content 调用 embedding API，得到向量，拼到每条记录上
    console.log("生成向量嵌入...");
    const conversationData = await Promise.all(
      conversations.map(async (conv) => ({
        ...conv,
        vector: await getEmbedding(conv.content),
      }))
    );

    // 批量插入 Milvus（id、vector、content、round、timestamp）
    const insertResult = await client.insert({
      collection_name: COLLECTION_NAME,
      data: conversationData,
    });
    console.log(`✓ 已插入 ${insertResult.insert_cnt} 条记录\n`);

    console.log("=".repeat(60));
    console.log("说明：已成功将对话数据插入到 Milvus 向量数据库");
    console.log("这些对话数据将用于后续的 RAG 检索");
    console.log("=".repeat(60) + "\n");
  } catch (error) {
    console.error("错误:", error.message);
  }
}

main();
