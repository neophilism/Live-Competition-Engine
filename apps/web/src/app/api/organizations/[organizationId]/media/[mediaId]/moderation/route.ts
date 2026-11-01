import { AuthenticationService } from "@live-competition-engine/auth";
import { createPostgresAuthStore } from "@live-competition-engine/db/auth-store";
import { moderateMedia } from "@live-competition-engine/db/media-library";
import { createMediaModerationHandler } from "@live-competition-engine/db/media-moderation-http";
export const dynamic="force-dynamic";
const moderate=createMediaModerationHandler(new AuthenticationService(createPostgresAuthStore()),moderateMedia);
export async function POST(request:Request,context:{params:Promise<{organizationId:string;mediaId:string}>}){
  const {organizationId,mediaId}=await context.params;
  return moderate(request,organizationId,mediaId);
}

