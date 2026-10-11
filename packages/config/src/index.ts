import { z } from "zod";

export const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url(),
  APP_URL: z.string().url().default("http://localhost:3000")
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(
  source: NodeJS.ProcessEnv = process.env
): ServerEnv {
  return serverEnvSchema.parse(source);
}
