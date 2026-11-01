import test from "node:test";
import assert from "node:assert/strict";
import { AuthenticationError } from "@live-competition-engine/auth";
import { createMediaVersionsHandler } from "./media-versions-http.ts";
const org="11111111-1111-4111-8111-111111111111",owner="22222222-2222-4222-8222-222222222222",id="33333333-3333-4333-8333-333333333333";
const auth={async authorize(){return{organizationId:org,accountId:owner,sessionId:id};}};
test("version history scopes cursor requests to authenticated owner",async()=>{
 const handler=createMediaVersionsHandler(auth,async(o,a,m,before)=>{assert.deepEqual([o,a,m,before],[org,owner,id,12]);return{items:[],next:null};});
 const response=await handler(new Request("https://engine.example/versions?before=12"),org,id);
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{items:[],next:null});
 assert.equal(response.headers.get("cache-control"),"private, no-store");
});
for(const query of ["before=0","before=NaN","before=2147483648","before=2&before=3","accountId="+owner]){
 test("version history rejects invalid scope "+query,async()=>{
  let called=false;const handler=createMediaVersionsHandler(auth,async()=>{called=true;return{};});
  assert.equal((await handler(new Request("https://engine.example/versions?"+query),org,id)).status,400);assert.equal(called,false);
 });
}
test("unauthorized history never reads metadata",async()=>{
 let called=false;const handler=createMediaVersionsHandler({async authorize(){throw new AuthenticationError("forbidden");}},async()=>{called=true;return{};});
 assert.equal((await handler(new Request("https://engine.example/versions"),org,id)).status,403);assert.equal(called,false);
});
test("version history storage failure reveals no details",async()=>{
 const handler=createMediaVersionsHandler(auth,async()=>{throw new Error("private storage detail");});
 const response=await handler(new Request("https://engine.example/versions"),org,id);
 assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:"media_unavailable"});
});

