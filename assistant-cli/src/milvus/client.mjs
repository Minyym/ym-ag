import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import { getConfig } from "../config.mjs";

export function getMilvusClient() {
  const cfg = getConfig();
  return new MilvusClient({ address: cfg.milvusAddress });
}
