import { OpenAIEmbeddings } from "@langchain/openai";
import { getConfig } from "../config.mjs";
import { VECTOR_DIM } from "../milvus/ensure-collection.mjs";

export function getEmbeddings() {
  const cfg = getConfig();
  return new OpenAIEmbeddings({
    apiKey: cfg.openaiApiKey,
    model: cfg.embeddingsModel,
    configuration: { baseURL: cfg.openaiBaseUrl },
    dimensions: VECTOR_DIM,
  });
}
