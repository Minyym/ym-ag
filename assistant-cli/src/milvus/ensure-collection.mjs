import {
  DataType,
  MetricType,
  IndexType,
} from "@zilliz/milvus2-sdk-node";
import { getMilvusClient } from "./client.mjs";

export const COLLECTION_NAME = "assistant_knowledge";
export const VECTOR_DIM = 1024;

export async function ensureKnowledgeCollection() {
  const client = getMilvusClient();

  const hasCollection = await client.hasCollection({
    collection_name: COLLECTION_NAME,
  });

  if (!hasCollection.value) {
    await client.createCollection({
      collection_name: COLLECTION_NAME,
      fields: [
        { name: "id", data_type: DataType.VarChar, max_length: 100, is_primary_key: true },
        { name: "type", data_type: DataType.VarChar, max_length: 50 },
        { name: "source_id", data_type: DataType.VarChar, max_length: 50 },
        { name: "content", data_type: DataType.VarChar, max_length: 10000 },
        { name: "meta", data_type: DataType.VarChar, max_length: 2000 },
        { name: "vector", data_type: DataType.FloatVector, dim: VECTOR_DIM },
      ],
    });

    await client.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: "vector",
      index_type: IndexType.IVF_FLAT,
      metric_type: MetricType.COSINE,
      params: { nlist: 1024 },
    });
  }

  try {
    await client.loadCollection({ collection_name: COLLECTION_NAME });
  } catch (error) {
    if (!error.message.includes("already loaded")) {
      throw error;
    }
  }
}
