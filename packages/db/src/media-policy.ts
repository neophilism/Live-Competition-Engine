import { createHash } from "node:crypto";
import { validateMediaSubmission, type MediaKind } from "./media-validation.ts";
export const mediaUploadLimit = 8 * 1024 * 1024;
export const mediaRightsVersion = "media-rights-v1";
export interface MediaUpload {
  organizationId: string; ownerId: string; mediaId?: string; expectedRevision: number;
  kind: MediaKind; mime: string; filename: string; rightsVersion: string;
  content: Uint8Array;
}
export function inspectMediaUpload(input: MediaUpload) {
  if (input.rightsVersion !== mediaRightsVersion) throw new Error("MEDIA_RIGHTS_REQUIRED");
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 ||
      (input.mediaId ? input.expectedRevision < 1 : input.expectedRevision !== 0)) {
    throw new Error("MEDIA_REVISION_CONFLICT");
  }
  if (!(input.content instanceof Uint8Array) || input.content.byteLength > mediaUploadLimit) {
    throw new Error("MEDIA_SIZE_FORBIDDEN");
  }
  const bytes = Buffer.from(input.content);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const metadata = validateMediaSubmission({ tenantId: input.organizationId, ownerId: input.ownerId,
    kind: input.kind, mime: input.mime, filename: input.filename, bytes: bytes.length, sha256: digest });
  const prefix = (hex: string) => bytes.subarray(0, hex.length / 2).equals(Buffer.from(hex, "hex"));
  const ascii = (start: number, text: string) => bytes.subarray(start, start + text.length).toString("ascii") === text;
  const matches: Record<string, boolean> = {
    "image/png": prefix("89504e470d0a1a0a"),
    "image/jpeg": prefix("ffd8ff"),
    "image/webp": ascii(0, "RIFF") && ascii(8, "WEBP"),
    "video/mp4": ascii(4, "ftyp"),
    "video/webm": prefix("1a45dfa3"),
    "audio/mpeg": ascii(0, "ID3") || (bytes[0] === 255 && ((bytes[1] ?? 0) & 224) === 224),
    "audio/ogg": ascii(0, "OggS"),
    "audio/wav": ascii(0, "RIFF") && ascii(8, "WAVE")
  };
  if (!matches[input.mime]) throw new Error("MEDIA_CONTENT_MISMATCH");
  // Signatures only reject obvious mismatches. Quarantine remains mandatory:
  // decoding/re-encoding and trusted safety approval are separate worker steps.
  return { ...metadata, content: bytes, rightsVersion: mediaRightsVersion };
}

