import { MediaDecodeRejected, transcodeMedia } from "./media-transcode.ts";
import type { MediaWork, MediaProcessed } from "./media-library.ts";
export interface MediaSafetyReview {
  review(input: { kind: MediaWork["kind"]; original: Uint8Array; derivative: Uint8Array }):
    Promise<{ approved: boolean; evidence: string }>;
}
/** One bounded job. Supply a trusted safety reviewer; absence or infrastructure
 * failure must throw and retain quarantine until lease expiry/recovery. */
export async function processOneMediaJob(dependencies: {
  claim(): Promise<MediaWork | null>;
  complete(work: MediaWork, output: MediaProcessed | null): Promise<boolean>;
  safety: MediaSafetyReview;
  transcode?: typeof transcodeMedia;
}): Promise<"idle" | "ready" | "rejected" | "stale"> {
  const work = await dependencies.claim(); if (!work) return "idle";
  let output;
  try { output = await (dependencies.transcode ?? transcodeMedia)(work.kind, work.content); }
  catch (cause) {
    if (!(cause instanceof MediaDecodeRejected)) throw cause;
    return await dependencies.complete(work, null) ? "rejected" : "stale";
  }
  const review = await dependencies.safety.review({ kind: work.kind, original: work.content, derivative: output.content });
  if (typeof review.approved !== "boolean" || typeof review.evidence !== "string" ||
      !review.evidence.trim() || review.evidence.length > 2048) throw new Error("MEDIA_SAFETY_UNAVAILABLE");
  const completed = await dependencies.complete(work, review.approved ? { ...output, safetyEvidence: review.evidence } : null);
  return completed ? review.approved ? "ready" : "rejected" : "stale";
}

