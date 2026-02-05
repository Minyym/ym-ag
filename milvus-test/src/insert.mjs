// 加载 .env 里的环境变量（API 密钥等），程序启动时自动读入
import "dotenv/config";
// 从 Milvus 官方 Node SDK 引入：客户端、数据类型、距离度量、索引类型
import {
  MilvusClient,
  DataType,
  MetricType,
  IndexType,
} from "@zilliz/milvus2-sdk-node";
// 引入 LangChain 的 OpenAI 文本向量化（embedding）封装
import { OpenAIEmbeddings } from "@langchain/openai";

// 集合名：在 Milvus 里相当于「表名」
const COLLECTION_NAME = "ai_diary";
// 向量维度：每条文本会被转成 1024 维的浮点数组，维度要和 embedding 模型一致
const VECTOR_DIM = 1024;

// 创建 OpenAI Embedding 实例，用来把「文字」转成「向量」
const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY, // API 密钥，从 .env 读取
  model: process.env.EMBEDDINGS_MODEL_NAME, // 使用的模型名，如 text-embedding-3-small
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL, // 可换成自建或代理的 API 地址
  },
  dimensions: VECTOR_DIM, // 指定输出向量维度
});

// 创建 Milvus 客户端，连接本机 19530 端口（Milvus 默认 gRPC 端口）
const client = new MilvusClient({
  address: "localhost:19530",
});

// 把一段文字转成向量的函数：调用 OpenAI，返回 1024 维浮点数组
async function getEmbedding(text) {
  const result = await embeddings.embedQuery(text); // 调用 API，得到向量
  return result;
}

// 主流程：建表、建索引、加载、插入数据
async function main() {
  try {
    // ---------- 连接 Milvus ----------
    console.log("Connecting to Milvus...");
    await client.connectPromise; // 等待连接就绪
    console.log("✓ Connected\n");

    // ---------- 创建集合（相当于建表 + 定义字段） ----------
    console.log("Creating collection...");
    await client.createCollection({
      collection_name: COLLECTION_NAME, // 表名
      fields: [
        {
          name: "id",
          data_type: DataType.VarChar, // 字符串
          max_length: 50,
          is_primary_key: true, // 主键，每条记录唯一
        },
        {
          name: "vector",
          data_type: DataType.FloatVector, // 浮点向量
          dim: VECTOR_DIM, // 维度 1024
        },
        {
          name: "content",
          data_type: DataType.VarChar,
          max_length: 5000, // 日记正文
        },
        {
          name: "date",
          data_type: DataType.VarChar,
          max_length: 50, // 日期，如 2026-01-10
        },
        {
          name: "mood",
          data_type: DataType.VarChar,
          max_length: 50, // 心情标签
        },
        {
          name: "tags",
          data_type: DataType.Array, // 数组类型
          element_type: DataType.VarChar,
          max_capacity: 10, // 最多 10 个标签
          max_length: 50, // 每个标签最长 50 字符
        },
      ],
    });
    console.log("Collection created");

    // ---------- 为 vector 字段建索引（加速相似度搜索） ----------
    console.log("\nCreating index...");
    await client.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: "vector", // 对哪个字段建索引
      index_type: IndexType.IVF_FLAT, // IVF_FLAT：平衡精度与速度的常用索引
      metric_type: MetricType.COSINE, // 用余弦相似度衡量「像不像」
      params: { nlist: 1024 }, // IVF 的聚类数，影响搜索速度和精度
    });
    console.log("Index created");

    // ---------- 加载集合到内存，之后才能被搜索 ----------
    console.log("\nLoading collection...");
    await client.loadCollection({ collection_name: COLLECTION_NAME });
    console.log("Collection loaded");

    // ---------- 准备要插入的日记数据（先只有文本，还没有 vector） ----------
    console.log("\nInserting diary entries...");
    const diaryContents = [
      {
        id: "diary_001",
        content:
          "今天天气很好，去公园散步了，心情愉快。看到了很多花开了，春天真美好。",
        date: "2026-01-10",
        mood: "happy",
        tags: ["生活", "散步"],
      },
      {
        id: "diary_002",
        content:
          "今天工作很忙，完成了一个重要的项目里程碑。团队合作很愉快，感觉很有成就感。",
        date: "2026-01-11",
        mood: "excited",
        tags: ["工作", "成就"],
      },
      {
        id: "diary_003",
        content:
          "周末和朋友去爬山，天气很好，心情也很放松。享受大自然的感觉真好。",
        date: "2026-01-12",
        mood: "relaxed",
        tags: ["户外", "朋友"],
      },
      {
        id: "diary_004",
        content:
          "今天学习了 Milvus 向量数据库，感觉很有意思。向量搜索技术真的很强大。",
        date: "2026-01-12",
        mood: "curious",
        tags: ["学习", "技术"],
      },
      {
        id: "diary_005",
        content:
          "晚上做了一顿丰盛的晚餐，尝试了新菜谱。家人都说很好吃，很有成就感。",
        date: "2026-01-13",
        mood: "proud",
        tags: ["美食", "家庭"],
      },
    ];

    // 为每条日记的 content 调用 getEmbedding，得到 vector，拼成完整一条记录
    console.log("Generating embeddings...");
    const diaryData = await Promise.all(
      diaryContents.map(async (diary) => ({
        ...diary, // 保留 id、content、date、mood、tags
        vector: await getEmbedding(diary.content), // 新增 vector 字段
      }))
    );

    // 把带 vector 的数据批量插入 Milvus
    const insertResult = await client.insert({
      collection_name: COLLECTION_NAME,
      data: diaryData,
    });
    console.log(`✓ Inserted ${insertResult.insert_cnt} records\n`);
  } catch (error) {
    // 任何一步出错都会在这里打印
    console.error("Error:", error.message);
  }
}

// 执行主流程
main();
