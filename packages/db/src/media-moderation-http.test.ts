import test from "node:test";
import assert from "node:assert/strict";
import { AuthenticationError } from "@live-competition-engine/auth";
import { createMediaModerationHandler } from "./media-moderation-http.ts";
const org="11111111-1111-4111-8111-111111111111",actor="22222222-2222-4222-8222-222222222222",id="33333333-3333-4333-8333-333333333333";
const request=(input:unknown={reason:"copyright"})=>new Request("https://engine.example/moderation",{
 method:"POST",headers:{authorization:"Bearer fixture"},body:JSON.stringify(input)});
test("moderation checks tenant.manage and records a bounded reason without exposing payload",async()=>{
 let invoked=0;
 const handler=createMediaModerationHandler({async authorizeAction(header,action,scope){
  assert.equal(header,"Bearer fixture");assert.equal(action,"tenant.manage");assert.deepEqual(scope,{organizationId:org});
  return{organizationId:org,accountId:actor,sessionId:id,role:"tenant_operator",roleGrantId:id,roleGrantVersion:1};
 }},async(o,a,m,reason)=>{invoked++;assert.deepEqual([o,a,m,reason],[org,actor,id,"copyright"]);return true;});
 const response=await handler(request(),org,id);assert.equal(response.status,204);assert.equal(invoked,1);
 assert.equal(response.headers.get("cache-control"),"private, no-store");
});
test("moderation rejects nonoperator before reading body or mutating",async()=>{
 let invoked=false;
 const handler=createMediaModerationHandler({async authorizeAction(){throw new AuthenticationError("forbidden");}},
  async()=>{invoked=true;return true;});
 assert.equal((await handler(request(),org,id)).status,403);assert.equal(invoked,false);
});
for(const input of [{reason:"anything"}, {reason:"safety",ownerId:actor},{reason:"x".repeat(2000)},[],null]){
 test("moderation rejects malformed/unbounded reason "+typeof input,async()=>{
  let invoked=false;
  const handler=createMediaModerationHandler({async authorizeAction(){return{organizationId:org,accountId:actor,
   sessionId:id,role:"tenant_operator",roleGrantId:id,roleGrantVersion:1};}},async()=>{invoked=true;return true;});
  assert.equal((await handler(request(input),org,id)).status,400);assert.equal(invoked,false);
 });
}
test("revoked database role cannot moderate after initial HTTP authorization",async()=>{
 const handler=createMediaModerationHandler({async authorizeAction(){return{organizationId:org,accountId:actor,
  sessionId:id,role:"tenant_operator",roleGrantId:id,roleGrantVersion:1};}},async()=>{throw new Error("MEDIA_SCOPE_DENIED");});
 assert.equal((await handler(request(),org,id)).status,403);
});

