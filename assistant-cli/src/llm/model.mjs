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
