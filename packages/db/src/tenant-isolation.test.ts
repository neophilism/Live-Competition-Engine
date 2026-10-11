import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { parseServerEnv } from "@live-competition-engine/config";

test("database rejects cross-tenant competition relationships", async () => {
  const sql = postgres(parseServerEnv().DATABASE_URL, { max: 1 });
  const orgA = randomUUID();
  const orgB = randomUUID();
  const competitionA = randomUUID();
  const competitionB = randomUUID();
  const participantA = randomUUID();
  const participantB = randomUUID();
  const entryA = randomUUID();
  const entryB = randomUUID();
  const roundA = randomUUID();
  const judgeB = randomUUID();

  try {
    await sql`INSERT INTO organizations (id, name, slug) VALUES
      (${orgA}, 'Tenant A', ${`tenant-a-${orgA}`}),
      (${orgB}, 'Tenant B', ${`tenant-b-${orgB}`})`;
    await sql`INSERT INTO competitions (id, organization_id, title) VALUES
      (${competitionA}, ${orgA}, 'Competition A'),
      (${competitionB}, ${orgB}, 'Competition B')`;
    await sql`INSERT INTO participants (id, organization_id, display_name) VALUES
      (${participantA}, ${orgA}, 'Participant A'),
      (${participantB}, ${orgB}, 'Participant B')`;
    await sql`INSERT INTO entries (id, organization_id, competition_id, participant_id) VALUES
      (${entryA}, ${orgA}, ${competitionA}, ${participantA}),
      (${entryB}, ${orgB}, ${competitionB}, ${participantB})`;
    await sql`INSERT INTO rounds (id, organization_id, competition_id, label, ordinal)
      VALUES (${roundA}, ${orgA}, ${competitionA}, 'Round A', 1)`;
    await sql`INSERT INTO judges (id, organization_id, display_name)
      VALUES (${judgeB}, ${orgB}, 'Judge B')`;

    await assert.rejects(
      sql`INSERT INTO performances (organization_id, competition_id, round_id, entry_id, ordinal)
        VALUES (${orgA}, ${competitionA}, ${roundA}, ${entryB}, 1)`,
      /violates foreign key constraint/
    );
    await assert.rejects(
      sql`INSERT INTO competition_judges (organization_id, competition_id, judge_id)
        VALUES (${orgA}, ${competitionA}, ${judgeB})`,
      /violates foreign key constraint/
    );
    await assert.rejects(
      sql`INSERT INTO results (organization_id, competition_id, round_id, entry_id)
        VALUES (${orgA}, ${competitionA}, ${roundA}, ${entryB})`,
      /violates foreign key constraint/
    );
  } finally {
    await sql.end();
  }
});
