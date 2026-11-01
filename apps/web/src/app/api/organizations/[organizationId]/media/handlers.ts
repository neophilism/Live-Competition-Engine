import { AuthenticationService } from "@live-competition-engine/auth";
import { createPostgresAuthStore } from "@live-competition-engine/db/auth-store";
import { storeMediaUpload, readMediaPlayback, revokeMedia, listOwnedMedia } from "@live-competition-engine/db/media-library";
import { createMediaHandlers } from "@live-competition-engine/db/media-http";
export const mediaHandlers = createMediaHandlers(new AuthenticationService(createPostgresAuthStore()), {
  upload: storeMediaUpload, playback: readMediaPlayback, revoke: revokeMedia, list:listOwnedMedia
});

