import { createHash } from "node:crypto";
import {
  AuthenticationError,
  type AuthenticationService
} from "@live-competition-engine/auth";

const MAX_LOGO_BYTES = 512 * 1024;
const allowedTypes = new Set(["image/png", "image/webp"]);

type LogoAuthorizer = Pick<AuthenticationService, "authorizeAction">;

export interface LogoAsset {
  contentType: "image/png" | "image/webp";
  sha256: string;
  content: Uint8Array;
}

export type PersistLogoAsset = (
  organizationId: string,
  accountId: string,
  asset: LogoAsset
) => Promise<{ id: string; path: string; sha256: string } | null>;

class UploadTooLarge extends Error {}

const isPng = (bytes: Uint8Array) =>
  bytes.length >= 8 &&
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    .every((value, index) => bytes[index] === value);

const isWebp = (bytes: Uint8Array) =>
  bytes.length >= 12 &&
  new TextDecoder("ascii").decode(bytes.slice(0, 4)) === "RIFF" &&
  new TextDecoder("ascii").decode(bytes.slice(8, 12)) === "WEBP";

const readBoundedBody = async (request: Request) => {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_LOGO_BYTES) {
      await reader.cancel();
      throw new UploadTooLarge();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
};

const errorResponse = (status: number, code: string) =>
  Response.json({ error: code }, { status });

export function createBrandLogoPostHandler(
  authorizer: LogoAuthorizer,
  persist: PersistLogoAsset
) {
  return async function postBrandLogo(
    request: Request,
    organizationId: string
  ): Promise<Response> {
    let principal;
    try {
      principal = await authorizer.authorizeAction(
        request.headers.get("authorization"),
        "tenant.manage",
        { organizationId }
      );
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return errorResponse(error.code === "forbidden" ? 403 : 401, error.code);
      }
      throw error;
    }

    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_LOGO_BYTES) {
      return errorResponse(413, "asset_too_large");
    }

    const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (!contentType || !allowedTypes.has(contentType)) {
      return errorResponse(415, "unsupported_asset_type");
    }

    let content: Uint8Array;
    try {
      content = await readBoundedBody(request);
    } catch (error) {
      if (error instanceof UploadTooLarge) return errorResponse(413, "asset_too_large");
      throw error;
    }

    const signatureMatches =
      (contentType === "image/png" && isPng(content)) ||
      (contentType === "image/webp" && isWebp(content));
    if (!signatureMatches) return errorResponse(415, "asset_signature_mismatch");

    const sha256 = createHash("sha256").update(content).digest("hex");
    const stored = await persist(
      organizationId,
      principal.accountId,
      {
        contentType: contentType as LogoAsset["contentType"],
        sha256,
        content
      }
    );
    if (!stored) return errorResponse(404, "organization_not_found");

    return Response.json(stored, { status: 201 });
  };
}
