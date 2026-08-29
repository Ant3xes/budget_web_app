import { z } from "zod";

/**
 * Postgres `uuid` accepts any 128-bit value. Seed IDs like
 * `b0000000-0000-0000-0000-000000000001` are valid in DB but fail
 * Zod's strict RFC uuid() (version/variant nibbles). Use guid().
 */
export const uuidSchema = z.string().guid();
