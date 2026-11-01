import { AuthenticationError, type AuthenticationService } from "@live-competition-engine/auth";
export function createMediaVersionsHandler(authorizer:Pick<AuthenticationService,"authorize">,
 read:(organizationId:string,ownerId:string,id:string,before?:number)=>Promise<unknown>){
 return async(request:Request,organizationId:string,id:string):Promise<Response>=>{
  const headers={"cache-control":"private, no-store",vary:"Authorization"};
  const error=(status:number,code:string)=>Response.json({error:code},{status,headers});
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if(!uuid.test(organizationId)||!uuid.test(id))return error(400,"invalid_media_scope");
  let actor;
  try{actor=await authorizer.authorize(request.headers.get("authorization"),organizationId);}
  catch(cause){return error(cause instanceof AuthenticationError?(cause.code==="forbidden"?403:401):503,"media_unavailable");}
  if(actor.organizationId!==organizationId)return error(403,"forbidden");
  const query=new URL(request.url).searchParams,raw=query.get("before");
  if([...query.keys()].some(k=>k!=="before"||query.getAll(k).length!==1)||
    (raw!==null&&(!/^[1-9][0-9]*$/.test(raw)||Number(raw)>2147483647)))return error(400,"invalid_revision_cursor");
  try{return Response.json(await read(organizationId,actor.accountId,id,raw===null?undefined:Number(raw)),{headers});}
  catch{return error(503,"media_unavailable");}
 };
}

