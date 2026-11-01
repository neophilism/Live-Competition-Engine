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

import { createServer } from "node:http";
test("FFmpeg pipe-only policy blocks nested network reads", {skip:!available}, async()=>{
 let requests=0;
 const server=createServer((_request,response)=>{requests++;response.end("fixture only");});
 await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
 try{
  const address=server.address();
  assert.ok(address&&typeof address==="object");
  const playlist=Buffer.from("#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:1\n#EXTINF:1,\nhttp://127.0.0.1:"+address.port+"/fixture.ts\n#EXT-X-ENDLIST\n");
  await assert.rejects(transcodeMedia("video",playlist),MediaDecodeRejected);
  assert.equal(requests,0);
 }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
test("audio transcoding strips uploaded comment/title metadata", {skip:!available},async()=>{
 const source=spawnSync("ffmpeg",["-hide_banner","-loglevel","error","-f","lavfi","-i","sine=frequency=440:duration=0.1",
  "-metadata","comment=fixture-private-comment","-metadata","title=fixture-private-title","-c:a","pcm_s16le","-f","wav","pipe:1"],
  {env:{PATH:process.env.PATH},maxBuffer:1024*1024});
 assert.equal(source.status,0);
 const output=await transcodeMedia("audio",source.stdout);
 const probe=spawnSync("ffprobe",["-hide_banner","-loglevel","error","-show_entries","format_tags:stream_tags","-of","json","pipe:0"],
  {input:output.content,env:{PATH:process.env.PATH},maxBuffer:1024*1024});
 assert.equal(probe.status,0);
 const metadata=probe.stdout.toString();
 assert.equal(metadata.includes("fixture-private-comment"),false);
 assert.equal(metadata.includes("fixture-private-title"),false);
});

