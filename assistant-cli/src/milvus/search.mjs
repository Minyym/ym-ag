import { MetricType } from "@zilliz/milvus2-sdk-node";
import { getMilvusClient } from "./client.mjs";
import { COLLECTION_NAME } from "./ensure-collection.mjs";

export async function searchKnowledge(vector, topK = 3) {
  const client = getMilvusClient();
  const searchResult = await client.search({
    collection_name: COLLECTION_NAME,
    vector,
    limit: topK,
    metric_type: MetricType.COSINE,
    output_fields: ["id", "type", "source_id", "content", "meta"],
  });
  return searchResult.results || [];
}
