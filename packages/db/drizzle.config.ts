import { defineConfig } from "drizzle-kit";
import { parseServerEnv } from "@live-competition-engine/config";

const env = parseServerEnv();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: env.DATABASE_URL
  },
  strict: true,
  verbose: true
});
