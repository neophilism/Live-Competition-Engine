import { AuthenticationService } from "@live-competition-engine/auth";
import { createPostgresAuthStore } from "@live-competition-engine/db/auth-store";
import { evaluateStoredFeature, setFeatureFlag } from "@live-competition-engine/db/feature-flags";
import { createFeatureHandlers } from "./handler";

const handlers = createFeatureHandlers(
  new AuthenticationService(createPostgresAuthStore()),
  setFeatureFlag,
  evaluateStoredFeature
);

export const POST = handlers.post;
export const GET = handlers.get;
