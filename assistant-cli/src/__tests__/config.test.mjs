import assert from "node:assert/strict";
import { getConfig } from "../config.mjs";

assert.throws(() => getConfig(), /OPENAI_API_KEY/);
