import {describe,it,expect} from "vitest";
import {createMediaClient} from "./media-client";
const org="11111111-1111-4111-8111-111111111111",id="22222222-2222-4222-8222-222222222222";
describe("media browser API boundary",()=>{
 it("sends current auth in headers with no cache, no cookies and no redirects",async()=>{
  const seen:Array<{url:string;init:RequestInit}>=[];let token="Bearer first";
  const client=createMediaClient(org,async()=>token,async(input,init)=>{
   seen.push({url:String(input),init:init!});return Response.json({items:[]});
  });
  await client.list();token="Bearer second";await client.list();
  expect(new Headers(seen[0]!.init.headers).get("authorization")).toBe("Bearer first");
  expect(new Headers(seen[1]!.init.headers).get("authorization")).toBe("Bearer second");
  expect(seen[0]!.init.cache).toBe("no-store");expect(seen[0]!.init.credentials).toBe("omit");
  expect(seen[0]!.init.redirect).toBe("error");expect(seen[0]!.url).not.toContain("Bearer");
 });
 it("does not send a request without a session or for malformed scope",async()=>{
  let called=false;
  const client=createMediaClient(org,async()=>null,async()=>{called=true;return new Response();});
  await expect(client.list()).rejects.toThrow("Sign in");expect(called).toBe(false);
  expect(()=>createMediaClient("../private",async()=>null)).toThrow();
  await expect(client.playback("../other")).rejects.toThrow("Invalid media item");
 });
 it("uploads only file data with the explicit rights version and derived kind",async()=>{
  const client=createMediaClient(org,async()=>"Bearer fixture",async(input,init)=>{
   expect(String(input)).toBe("/api/organizations/"+org+"/media");expect(init?.method).toBe("POST");
   const headers=new Headers(init?.headers);expect(headers.get("x-media-rights-version")).toBe("media-rights-v1");
   expect(headers.get("x-media-kind")).toBe("image");expect(headers.get("x-media-filename")).toBe("fixture.png");
   expect(init?.body).toBeInstanceOf(File);return Response.json({status:"quarantined"},{status:202});
  });
  await client.upload(new File([new Uint8Array([1])],"fixture.png",{type:"image/png"}));
 });
 it("rejects oversized or unknown files before network access",async()=>{
  let called=false;const client=createMediaClient(org,async()=>"Bearer fixture",async()=>{called=true;return new Response();});
  await expect(client.upload(new File([new Uint8Array(8*1024*1024+1)],"large.png",{type:"image/png"}))).rejects.toThrow("8 MiB");
  await expect(client.upload(new File(["html"],"bad.html",{type:"text/html"}))).rejects.toThrow();
  expect(called).toBe(false);
 });
 it("replaces the exact observed revision and rejects invalid replacement IDs",async()=>{
  let called=0;
  const client=createMediaClient(org,async()=>"Bearer fixture",async(input,init)=>{
   called++;expect(String(input)).toBe("/api/organizations/"+org+"/media/"+id);
   expect(new Headers(init?.headers).get("if-match")).toBe("3");
   return Response.json({status:"quarantined"},{status:202});
  });
  const file=new File([new Uint8Array([1])],"next.png",{type:"image/png"});
  await client.upload(file,{id,revision:3});
  await expect(client.upload(file,{id,revision:0})).rejects.toThrow("Refresh");
  await expect(client.upload(file,{id:"../other",revision:3})).rejects.toThrow("Invalid media item");
  expect(called).toBe(1);
 });
 it("fetches private playback bytes and uses DELETE for withdrawal",async()=>{
  const methods:string[]=[];
  const client=createMediaClient(org,async()=>"Bearer fixture",async(input,init)=>{
   expect(String(input)).toBe("/api/organizations/"+org+"/media/"+id);methods.push(init?.method??"GET");
   return init?.method==="DELETE"?new Response(null,{status:204}):new Response(new Uint8Array([1]),{headers:{"content-type":"image/jpeg"}});
  });
  expect((await client.playback(id)).type).toBe("image/jpeg");await client.revoke(id);
  expect(methods).toEqual(["GET","DELETE"]);
 });
 it("does not reveal server failure details",async()=>{
  const client=createMediaClient(org,async()=>"Bearer fixture",async()=>new Response("private database detail",{status:503}));
  await expect(client.list()).rejects.toThrow("Media is unavailable");
 });
 it("pages revision metadata without identity tokens in URLs",async()=>{
  let called=0;
  const client=createMediaClient(org,async()=>"Bearer fixture",async(input)=>{
   called++;expect(String(input)).toBe("/api/organizations/"+org+"/media/"+id+"/versions?before=12");
   return Response.json({items:[],next:null});
  });
  expect(await client.versions(id,12)).toEqual({items:[],next:null});
  await expect(client.versions(id,0)).rejects.toThrow("Invalid revision cursor");expect(called).toBe(1);
 });
});

