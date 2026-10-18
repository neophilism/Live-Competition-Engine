export type ProfileRole = "performer" | "producer" | "judge";
export interface PublicHistoryItem {
  eventId: string;
  title: string;
  public: boolean;
}
export interface ProfileRecord {
  id: string;
  organizationId: string;
  ownerAccountId: string;
  revision: number;
  displayName: string;
  bio: string;
  roles: readonly ProfileRole[];
  visibility: "public" | "members" | "private";
  history: readonly PublicHistoryItem[];
}
export interface ProfileViewer {
  accountId: string;
  organizationId: string;
}
export interface ProfileView {
  readonly id: string;
  readonly revision: number;
  readonly displayName: string;
  readonly bio: string;
  readonly roles: readonly ProfileRole[];
  readonly history: ReadonlyArray<Readonly<{ eventId: string; title: string }>>;
}
const validId = (id: unknown): id is string =>
  typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
const boundedText = (text: unknown, max: number): text is string =>
  typeof text === "string" && text.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text);

/** Server-only projection; viewer must come from verified active membership. */
export function projectProfile(
  profile: ProfileRecord,
  authorizedOrganizationId: string,
  viewer: ProfileViewer | null
): ProfileView | null {
  if (!validId(authorizedOrganizationId) || !validId(profile.id) ||
    !validId(profile.organizationId) || !validId(profile.ownerAccountId) ||
    !Number.isSafeInteger(profile.revision) || profile.revision < 1 ||
    !boundedText(profile.displayName, 100) || !profile.displayName.trim() ||
    !boundedText(profile.bio, 2000) ||
    !["public", "members", "private"].includes(profile.visibility) ||
    !Array.isArray(profile.roles) || profile.roles.length > 3 ||
    new Set(profile.roles).size !== profile.roles.length ||
    !profile.roles.every(role => ["performer", "producer", "judge"].includes(role)) ||
    !Array.isArray(profile.history) || profile.history.length > 100 ||
    !profile.history.every(item => validId(item.eventId) && boundedText(item.title, 200) && typeof item.public === "boolean")) {
    throw new Error("Invalid profile.");
  }
  if (profile.organizationId !== authorizedOrganizationId) return null;
  if (viewer && (!validId(viewer.accountId) || viewer.organizationId !== authorizedOrganizationId)) return null;
  const owner = viewer?.accountId === profile.ownerAccountId;
  if (profile.visibility === "private" && !owner) return null;
  if (profile.visibility === "members" && !viewer) return null;
  return Object.freeze({
    id: profile.id,
    revision: profile.revision,
    displayName: profile.displayName,
    bio: profile.bio,
    roles: Object.freeze([...profile.roles]),
    // Private history is never published by this read projection, including to owners.
    history: Object.freeze(profile.history.filter(item => item.public).map(item =>
      Object.freeze({ eventId: item.eventId, title: item.title })
    ))
  });
}

export interface ProfileStore {
  find(organizationId: string, profileId: string): Promise<ProfileRecord | null>;
  // Atomic tenant/id/revision comparison; null expected revision means INSERT only.
  compareAndSet(profile: ProfileRecord, expectedRevision: number | null): Promise<boolean>;
}
export interface ProfilePatch {
  displayName: string;
  bio: string;
  roles: readonly ProfileRole[];
  visibility: ProfileRecord["visibility"];
}
export class ProfileService {
  private readonly store: ProfileStore;
  constructor(store: ProfileStore) { this.store = store; }

  async read(organizationId: string, profileId: string, viewer: ProfileViewer | null): Promise<ProfileView | null> {
    if (!validId(organizationId) || !validId(profileId)) throw new Error("Invalid profile scope.");
    if (viewer && (!validId(viewer.accountId) || viewer.organizationId !== organizationId)) return null;
    const profile = await this.store.find(organizationId, profileId);
    return profile ? projectProfile(profile, organizationId, viewer) : null;
  }

  /** viewer is a freshly authenticated active tenant member, never request JSON. */
  async edit(
    organizationId: string,
    profileId: string,
    viewer: ProfileViewer,
    patch: ProfilePatch,
    expectedRevision: number | null
  ): Promise<ProfileView> {
    if (!validId(organizationId) || !validId(profileId) || !validId(viewer.accountId) ||
      viewer.organizationId !== organizationId ||
      (expectedRevision !== null && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1))) {
      throw new Error("Profile edit denied.");
    }
    // Reject mass assignment: history, owner and revision are not client-editable.
    const keys = Object.keys(patch).sort();
    if (keys.join(",") !== "bio,displayName,roles,visibility") throw new Error("Invalid profile patch.");
    const snapshot: ProfilePatch = {
      displayName: patch.displayName, bio: patch.bio, roles: [...patch.roles], visibility: patch.visibility
    };
    const accountId = viewer.accountId;
    const previous = await this.store.find(organizationId, profileId);
    if (previous && (previous.id !== profileId || previous.organizationId !== organizationId || previous.ownerAccountId !== accountId)) {
      throw new Error("Profile edit denied.");
    }
    if ((!previous && expectedRevision !== null) || (previous && previous.revision !== expectedRevision)) {
      throw new Error("Profile revision conflict.");
    }
    const profile: ProfileRecord = {
      id: profileId, organizationId, ownerAccountId: accountId,
      revision: (previous?.revision ?? 0) + 1,
      ...snapshot,
      // Linked history comes only from trusted publication workflows.
      history: previous ? previous.history.map(item => ({ ...item })) : []
    };
    const view = projectProfile(profile, organizationId, { organizationId, accountId });
    if (!view) throw new Error("Profile edit denied.");
    if (!(await this.store.compareAndSet(profile, expectedRevision))) throw new Error("Profile revision conflict.");
    return view;
  }
}
