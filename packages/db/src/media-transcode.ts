import { spawn } from "node:child_process";
import type { MediaKind } from "./media-validation.ts";
import { mediaUploadLimit } from "./media-policy.ts";

export class MediaDecodeRejected extends Error {}
/** Run in a worker sandbox without application credentials or network access.
 * Only pipe input/output protocols are enabled; no paths or flags come from users. */
export function transcodeMedia(kind: MediaKind, content: Uint8Array, executable = "ffmpeg"):
  Promise<{ mime: "image/jpeg" | "video/mp4" | "audio/ogg"; content: Uint8Array }> {
  if (!(content instanceof Uint8Array) || content.byteLength < 1 || content.byteLength > mediaUploadLimit ||
      !["image","video","audio"].includes(kind)) return Promise.reject(new MediaDecodeRejected("MEDIA_DECODE_REJECTED"));
  const output = {
    image: { mime: "image/jpeg" as const, flags: ["-map","0:v:0","-an","-frames:v","1","-vf","scale=w='min(640,iw)':h='min(640,ih)':force_original_aspect_ratio=decrease","-c:v","mjpeg","-f","image2pipe"] },
    video: { mime: "video/mp4" as const, flags: ["-map","0:v:0","-map","0:a:0?","-t","60","-vf","scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2","-r","30","-c:v","libx264","-preset","fast","-c:a","aac","-movflags","frag_keyframe+empty_moov","-f","mp4"] },
    audio: { mime: "audio/ogg" as const, flags: ["-map","0:a:0","-vn","-t","300","-c:a","libopus","-f","ogg"] }
  }[kind];
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ["-hide_banner","-loglevel","error","-nostdin","-max_alloc","16777216",
      "-threads","1","-filter_threads","1","-protocol_whitelist","pipe","-i","pipe:0",
      "-map_metadata","-1","-map_chapters","-1", ...output.flags,"-threads","1","pipe:1"],
      { shell: false, env: { PATH: process.env.PATH ?? "/usr/bin:/bin" }, stdio: ["pipe","pipe","pipe"] });
    const chunks: Buffer[] = []; let bytes = 0; let settled = false;
    const fail = (cause: Error) => { if (settled) return; settled = true; clearTimeout(timer); child.kill("SIGKILL"); reject(cause); };
    const timer = setTimeout(() => fail(new MediaDecodeRejected("MEDIA_DECODE_TIMEOUT")), 30_000);
    child.on("error", () => fail(new Error("MEDIA_TRANSCODER_UNAVAILABLE")));
    child.stdin.on("error", () => {}); // decoder closes input on malformed media
    child.stderr.resume(); // never persist private filenames/metadata from decoder errors
    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > mediaUploadLimit) fail(new MediaDecodeRejected("MEDIA_OUTPUT_TOO_LARGE"));
      else chunks.push(chunk);
    });
    child.on("close", code => {
      if (settled) return; settled = true; clearTimeout(timer);
      if (code !== 0 || bytes === 0) reject(new MediaDecodeRejected("MEDIA_DECODE_REJECTED"));
      else resolve({ mime: output.mime, content: new Uint8Array(Buffer.concat(chunks, bytes)) });
    });
    child.stdin.end(Buffer.from(content));
  });
}

