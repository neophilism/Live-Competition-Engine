import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { transcodeMedia, MediaDecodeRejected } from "./media-transcode.ts";
const available=spawnSync("ffmpeg",["-version"],{env:{PATH:process.env.PATH},stdio:"ignore"}).status===0;
// This is an explicit optional local fixture, never mistaken for a CI pass when absent.
test("FFmpeg decodes/reencodes generated image/audio/video fixtures",{skip:!available},async()=>{
  const fixtures=[
    {kind:"image" as const,args:["-f","lavfi","-i","color=c=red:s=16x16","-frames:v","1","-c:v","png","-f","image2pipe"],mime:"image/jpeg"},
    {kind:"audio" as const,args:["-f","lavfi","-i","sine=frequency=440:duration=0.1","-c:a","pcm_s16le","-f","wav"],mime:"audio/ogg"},
    {kind:"video" as const,args:["-f","lavfi","-i","color=c=blue:s=32x32:r=1:d=0.1","-c:v","libvpx","-f","webm"],mime:"video/mp4"}
  ];
  for(const fixture of fixtures) {
    const source=spawnSync("ffmpeg",["-hide_banner","-loglevel","error",...fixture.args,"pipe:1"],{env:{PATH:process.env.PATH},maxBuffer:8*1024*1024});
    assert.equal(source.status,0,source.stderr?.toString());
    const output=await transcodeMedia(fixture.kind,source.stdout);
    assert.equal(output.mime,fixture.mime);assert.ok(output.content.length>0);
  }
});
test("FFmpeg rejects truncated signature-valid PNG",{skip:!available},async()=>{
  await assert.rejects(transcodeMedia("image",Buffer.from("89504e470d0a1a0a","hex")),MediaDecodeRejected);
});
test("FFmpeg absence is an infrastructure failure, not content approval",async()=>{
  await assert.rejects(transcodeMedia("image",new Uint8Array([1]),"/nonexistent/lc11-ffmpeg"),/MEDIA_TRANSCODER_UNAVAILABLE/);
});

