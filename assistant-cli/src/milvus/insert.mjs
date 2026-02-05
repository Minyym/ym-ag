import { getMilvusClient } from "./client.mjs";
import { COLLECTION_NAME } from "./ensure-collection.mjs";

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export async function insertKnowledge({ type, sourceId, content, vector, meta }) {
  const client = getMilvusClient();
  const id = genId(type);
  const data = [
    {
      id,
      type,
      source_id: String(sourceId),
      content,
      meta: JSON.stringify(meta || {}),
      vector,
    },
  ];
  const result = await client.insert({
    collection_name: COLLECTION_NAME,
    data,
  });
  return { id, insertCount: result.insert_cnt || 0 };
}
