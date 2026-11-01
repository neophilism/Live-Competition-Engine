import { AuthenticationService } from "@live-competition-engine/auth";
import { createPostgresAuthStore } from "@live-competition-engine/db/auth-store";
import { listMediaVersions } from "@live-competition-engine/db/media-library";
import { createMediaVersionsHandler } from "@live-competition-engine/db/media-versions-http";
export const dynamic="force-dynamic";
const versions=createMediaVersionsHandler(new AuthenticationService(createPostgresAuthStore()),listMediaVersions);
export async function GET(request:Request,context:{params:Promise<{organizationId:string;mediaId:string}>}){
 const{organizationId,mediaId}=await context.params;return versions(request,organizationId,mediaId);
}

