import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { parseServerEnv } from "@live-competition-engine/config";
import * as schema from "./schema.ts";

let client: ReturnType<typeof postgres> | undefined;

export function getSqlClient() {
  if (!client) {
    const env = parseServerEnv();
    client = postgres(env.DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10
    });
  }

  return client;
}

export function getDatabase() {
  return drizzle(getSqlClient(), { schema });
}

export async function checkDatabaseConnection() {
  await getSqlClient()`select 1`;
}
