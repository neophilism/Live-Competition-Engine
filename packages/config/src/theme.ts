import {z} from "zod";

const relativeAssetPath = z.string().max(512).refine(
  value => value.startsWith("/") && !value.startsWith("//") && !value.includes(":"),
  "Brand assets must use an application-relative path."
);
const navigationItem = z.object({
  label: z.string().trim().min(1).max(48),
  path: z.string().max(160).refine(
    value => value.startsWith("/") && !value.startsWith("//") && !value.includes(":"),
    "Navigation destinations must be application-relative paths."
  )
}).strict();

export const tenantThemeSchema = z.object({
  logoPath: relativeAssetPath.nullable().default(null),
  colors: z.object({
    primary: z.string().regex(/^#[0-9a-f]{6}$/i),
    surface: z.string().regex(/^#[0-9a-f]{6}$/i),
    text: z.string().regex(/^#[0-9a-f]{6}$/i),
    accent: z.string().regex(/^#[0-9a-f]{6}$/i)
  }).strict(),
  typography: z.enum(["system", "humanist", "geometric"]),
  template: z.enum(["editorial", "broadcast", "compact"]),
  navigation: z.array(navigationItem).max(8).superRefine((items,ctx)=>{
    const paths=new Set<string>();
    for(const [index,item] of items.entries()) {
      if(paths.has(item.path)) ctx.addIssue({code:"custom",message:"Navigation paths must be unique.",path:[index,"path"]});
      paths.add(item.path);
    }
  })
}).strict();

export type TenantTheme = z.infer<typeof tenantThemeSchema>;

export function parseTenantTheme(input:unknown):TenantTheme {
  return tenantThemeSchema.parse(input);
}

export function requireTenantThemeScope(requestedOrganizationId:string,authorizedOrganizationId:string) {
  if(!requestedOrganizationId || requestedOrganizationId!==authorizedOrganizationId) {
    throw new Error("Tenant theme access denied.");
  }
}
