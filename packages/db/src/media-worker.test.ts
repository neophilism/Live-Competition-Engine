import test from "node:test";
import assert from "node:assert/strict";
import { processOneMediaJob } from "./media-worker.ts";
import { MediaDecodeRejected } from "./media-transcode.ts";
import type { MediaWork, MediaProcessed } from "./media-library.ts";
const work: MediaWork={id:"id",organizationId:"tenant",revision:1,token:"token",kind:"image",content:new Uint8Array([1])};
function fixture() {
  const state={completed:[] as Array<MediaProcessed|null>,approved:true,evidence:"fixture-only-review",stale:false};
  const dependencies={
    claim:async()=>work,
    complete:async (_work:MediaWork,output:MediaProcessed|null)=>{state.completed.push(output);return !state.stale;},
    transcode:async()=>({mime:"image/jpeg" as const,content:new Uint8Array([255,216,255])}),
    safety:{review:async()=>({approved:state.approved,evidence:state.evidence})}
  };
  return {state,dependencies};
}
test("worker requires transcode and trusted review before completion",async()=>{
  const {state,dependencies}=fixture();
  assert.equal(await processOneMediaJob(dependencies),"ready");
  assert.equal(state.completed[0]?.safetyEvidence,"fixture-only-review");
});
test("worker does not publish a safety denial",async()=>{
  const {state,dependencies}=fixture();state.approved=false;
  assert.equal(await processOneMediaJob(dependencies),"rejected");assert.deepEqual(state.completed,[null]);
});
test("worker records malformed media rejection without approving original",async()=>{
  const {state,dependencies}=fixture();dependencies.transcode=async()=>{throw new MediaDecodeRejected("bad");};
  assert.equal(await processOneMediaJob(dependencies),"rejected");assert.deepEqual(state.completed,[null]);
});
for(const failure of ["decode-infrastructure","review-infrastructure","missing-evidence"]) {
  test("worker leaves recoverable quarantine on "+failure,async()=>{
    const {state,dependencies}=fixture();
    if(failure==="decode-infrastructure")dependencies.transcode=async()=>{throw new Error("missing worker");};
    if(failure==="review-infrastructure")dependencies.safety.review=async()=>{throw new Error("unavailable");};
    if(failure==="missing-evidence")state.evidence="";
    await assert.rejects(processOneMediaJob(dependencies));assert.equal(state.completed.length,0);
  });
}
test("stale lease cannot be reported published",async()=>{
  const {state,dependencies}=fixture();state.stale=true;
  assert.equal(await processOneMediaJob(dependencies),"stale");
});
test("empty queue invokes neither transcode nor review",async()=>{
  const {state,dependencies}=fixture();
  assert.equal(await processOneMediaJob({...dependencies,claim:async()=>null}),"idle");assert.equal(state.completed.length,0);
});

