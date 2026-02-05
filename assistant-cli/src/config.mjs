import "dotenv/config";

export function getConfig() {
  const required = [
    "OPENAI_API_KEY",
    "OPENAI_BASE_URL",
    "MODEL_NAME",
    "EMBEDDINGS_MODEL_NAME",
    "MYSQL_HOST",
    "MYSQL_PORT",
    "MYSQL_USER",
    "MYSQL_PASSWORD",
    "MYSQL_DATABASE",
    "MILVUS_ADDRESS",
  ];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`${key} is required`);
    }
  }

  return {
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiBaseUrl: process.env.OPENAI_BASE_URL,
    modelName: process.env.MODEL_NAME,
    embeddingsModel: process.env.EMBEDDINGS_MODEL_NAME,
    mysql: {
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
    },
    milvusAddress: process.env.MILVUS_ADDRESS,
    memoryFile: process.env.MEMORY_FILE || "chat_history.json",
    memoryMaxTokens: Number(process.env.MEMORY_MAX_TOKENS || 800),
    memoryKeepTokens: Number(process.env.MEMORY_KEEP_TOKENS || 300),
  };
}
