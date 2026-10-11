import { resolveTenantDomain } from "@live-competition-engine/db/tenant-domains";
import { createTenantContextGetHandler } from "./handler";

const getTenantContext = createTenantContextGetHandler(resolveTenantDomain);

export async function GET(request: Request) {
  return getTenantContext(request);
}
