import { z } from "zod";

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
  navigation: z.array(navigationItem).max(8).superRefine((items, ctx) => {
    const paths = new Set<string>();
    for (const [index, item] of items.entries()) {
      if (paths.has(item.path)) {
        ctx.addIssue({
          code: "custom",
          message: "Navigation paths must be unique.",
          path: [index, "path"]
        });
      }
      paths.add(item.path);
    }
  })
}).strict();

export type TenantTheme = z.infer<typeof tenantThemeSchema>;

const engineFontStacks = {
  system: "ui-sans-serif, system-ui, sans-serif",
  humanist: "\"Trebuchet MS\", \"Segoe UI\", sans-serif",
  geometric: "\"Avenir Next\", Avenir, Montserrat, sans-serif"
} as const;

export interface TenantThemeViewModel {
  readonly logoPath: string | null;
  readonly template: TenantTheme["template"];
  readonly navigation: ReadonlyArray<Readonly<{ label: string; path: string }>>;
  readonly style: Readonly<{
    "--lce-color-primary": string;
    "--lce-color-surface": string;
    "--lce-color-text": string;
    "--lce-color-accent": string;
    "--lce-font-family": string;
  }>;
}

export function parseTenantTheme(input: unknown): TenantTheme {
  return tenantThemeSchema.parse(input);
}

export function buildTenantThemeViewModel(input: unknown): TenantThemeViewModel {
  const theme = parseTenantTheme(input);
  return Object.freeze({
    logoPath: theme.logoPath,
    template: theme.template,
    navigation: Object.freeze(
      theme.navigation.map(item => Object.freeze({ ...item }))
    ),
    style: Object.freeze({
      "--lce-color-primary": theme.colors.primary,
      "--lce-color-surface": theme.colors.surface,
      "--lce-color-text": theme.colors.text,
      "--lce-color-accent": theme.colors.accent,
      "--lce-font-family": engineFontStacks[theme.typography]
    })
  });
}

export function requireTenantThemeScope(
  requestedOrganizationId: string,
  authorizedOrganizationId: string
) {
  if (!requestedOrganizationId || requestedOrganizationId !== authorizedOrganizationId) {
    throw new Error("Tenant theme access denied.");
  }
}
