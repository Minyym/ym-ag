import assert from "node:assert/strict";
import { contactSchema, diarySchema, kbSchema } from "../schemas.mjs";

assert.ok(contactSchema && diarySchema && kbSchema);
