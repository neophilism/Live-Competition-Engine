import { sql } from "drizzle-orm";
import { getDatabase } from "./index";

const db = getDatabase();

await db.execute(sql`
  INSERT INTO engine_metadata ("key", "value")
  VALUES ('foundation', '{"seeded": true}'::jsonb)
  ON CONFLICT ("key")
  DO UPDATE SET
    "value" = EXCLUDED."value",
    "updated_at" = now()
`);

console.log("Development seed applied.");
