CREATE UNIQUE INDEX "entries_org_id_uniq" ON "entries" ("organization_id", "id");
CREATE UNIQUE INDEX "rounds_org_id_uniq" ON "rounds" ("organization_id", "id");
CREATE UNIQUE INDEX "judges_org_id_uniq" ON "judges" ("organization_id", "id");

ALTER TABLE "performances"
  ADD CONSTRAINT "performances_org_entry_fk"
  FOREIGN KEY ("organization_id", "entry_id")
  REFERENCES "entries" ("organization_id", "id");

ALTER TABLE "competition_judges"
  ADD CONSTRAINT "competition_judges_org_judge_fk"
  FOREIGN KEY ("organization_id", "judge_id")
  REFERENCES "judges" ("organization_id", "id");

ALTER TABLE "results"
  ADD CONSTRAINT "results_org_entry_fk"
  FOREIGN KEY ("organization_id", "entry_id")
  REFERENCES "entries" ("organization_id", "id");

ALTER TABLE "results"
  ADD CONSTRAINT "results_org_round_fk"
  FOREIGN KEY ("organization_id", "round_id")
  REFERENCES "rounds" ("organization_id", "id");
