import assert from "node:assert/strict";
import { getModel } from "../llm/model.mjs";
import { getEmbeddings } from "../llm/embeddings.mjs";

assert.ok(getModel && getEmbeddings);
