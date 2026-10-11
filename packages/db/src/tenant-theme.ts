import type { TenantTheme } from "@live-competition-engine/config/theme";
import { getSqlClient } from "./index.ts";

export interface ActivatedTenantTheme {
  organizationId: string;
  revision: number;
}

export async function activateTenantTheme(
  organizationId: string,
  accountId: string,
  theme: TenantTheme
): Promise<ActivatedTenantTheme | null> {
  const sql = getSqlClient();

  return sql.begin(async tx => {
    const organization = await tx<{ id: string }[]>`
      SELECT id
      FROM organizations
      WHERE id = ${organizationId}
      FOR UPDATE
    `;
    if (organization.length !== 1) return null;

    const [latest] = await tx<{ revision: number }[]>`
      SELECT COALESCE(MAX(revision), 0)::integer AS revision
      FROM organization_theme_versions
      WHERE organization_id = ${organizationId}
    `;
    const revision = (latest?.revision ?? 0) + 1;

    await tx`
      UPDATE organization_theme_versions
      SET is_active = false
      WHERE organization_id = ${organizationId} AND is_active
    `;
    await tx`
      INSERT INTO organization_theme_versions (
        organization_id, revision, is_active, logo_path,
        primary_color, surface_color, text_color, accent_color,
        typography, template, navigation, updated_by_account_id
      ) VALUES (
        ${organizationId}, ${revision}, true, ${theme.logoPath},
        ${theme.colors.primary}, ${theme.colors.surface}, ${theme.colors.text}, ${theme.colors.accent},
        ${theme.typography}, ${theme.template}, ${tx.json(theme.navigation)}, ${accountId}
      )
    `;

    return { organizationId, revision };
  });
}
