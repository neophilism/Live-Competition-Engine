import { mediaHandlers } from "./handlers";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params;
  return mediaHandlers.upload(request, organizationId);
}

