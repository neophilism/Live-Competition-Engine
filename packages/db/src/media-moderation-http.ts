import { AuthenticationError, type AuthenticationService } from "@live-competition-engine/auth";
import { boundedMediaBody } from "./media-http.ts";
export function createMediaModerationHandler(
  authorizer: Pick<AuthenticationService,"authorizeAction">,
  moderate: (organizationId:string,actorId:string,id:string,reason:"copyright"|"safety"|"consent")=>Promise<boolean>
) {
  return async(request:Request,organizationId:string,id:string):Promise<Response>=>{
    const headers={"cache-control":"private, no-store",vary:"Authorization"};
    const error=(status:number,code:string)=>Response.json({error:code},{status,headers});
    const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if(!uuid.test(organizationId)||!uuid.test(id))return error(400,"invalid_media_scope");
    let actor;
    try {actor=await authorizer.authorizeAction(request.headers.get("authorization"),"tenant.manage",{organizationId});}
    catch(cause){
      if(cause instanceof AuthenticationError)return error(cause.code==="forbidden"?403:401,cause.code);
      return error(503,"media_unavailable");
    }
    if(actor.organizationId!==organizationId)return error(403,"forbidden");
    let input:unknown;
    try {input=JSON.parse(new TextDecoder().decode(await boundedMediaBody(request,1024)));}catch{return error(400,"invalid_moderation");}
    if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).length!==1||
      !("reason" in input)||!["copyright","safety","consent"].includes(String(input.reason)))return error(400,"invalid_moderation");
    try{
      return await moderate(organizationId,actor.accountId,id,input.reason as "copyright"|"safety"|"consent")
        ?new Response(null,{status:204,headers}):error(404,"media_not_found");
    }catch(cause){return error(cause instanceof Error&&cause.message==="MEDIA_SCOPE_DENIED"?403:503,"media_unavailable");}
  };
}

