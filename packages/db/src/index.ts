import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { parseServerEnv } from "@live-competition-engine/config";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | undefined;

function getClient() {
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
  return drizzle(getClient(), { schema });
}

export async function checkDatabaseConnection() {
  await getClient()`select 1`;
}
