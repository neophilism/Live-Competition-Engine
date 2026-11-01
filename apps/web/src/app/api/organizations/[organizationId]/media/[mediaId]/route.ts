import { mediaHandlers } from "../handlers";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ organizationId: string; mediaId: string }> };
export async function POST(request: Request, context: Context) {
  const { organizationId, mediaId } = await context.params;
  return mediaHandlers.upload(request, organizationId, mediaId);
}
export async function GET(request: Request, context: Context) {
  const { organizationId, mediaId } = await context.params;
  return mediaHandlers.playback(request, organizationId, mediaId);
}
export async function DELETE(request: Request, context: Context) {
  const { organizationId, mediaId } = await context.params;
  return mediaHandlers.revoke(request, organizationId, mediaId);
}

