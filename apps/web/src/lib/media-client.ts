export interface MediaItem {id:string;revision:number;filename:string;kind:"image"|"audio"|"video";status:string;}
export interface MediaVersion {revision:number;filename:string;kind:MediaItem["kind"];status:string;rightsVersion:string;acceptedAt:string;}
export interface MediaClient {
  list():Promise<MediaItem[]>;
  upload(file:File,replacing?:{id:string;revision:number}):Promise<void>;
  playback(id:string):Promise<Blob>;
  revoke(id:string):Promise<void>;
  versions(id:string,before?:number):Promise<{items:MediaVersion[];next:number|null}>;
}
/** Supply a fresh session-token callback from the host's identity layer.
 * Tokens stay in request headers and are never stored, logged or placed in URLs. */
export function createMediaClient(organizationId:string,authorization:()=>Promise<string|null>,fetcher:typeof fetch=fetch):MediaClient {
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!uuid.test(organizationId))throw new Error("Select a valid workspace.");
 const root="/api/organizations/"+organizationId+"/media";
 async function request(path:string,init:RequestInit={}):Promise<Response>{
  const token=await authorization();if(!token)throw new Error("Sign in to use your media library.");
  const headers=new Headers(init.headers);headers.set("authorization",token);
  const response=await fetcher(root+path,{...init,headers,cache:"no-store",credentials:"omit",redirect:"error"});
  if(!response.ok){
   if(response.status===401||response.status===403)throw new Error("Your session cannot access this media.");
   if(response.status===413)throw new Error("Choose a file no larger than 8 MiB.");
   if(response.status===409)throw new Error("Your library changed or reached its storage limit. Refresh and try again.");
   throw new Error("Media is unavailable. Please try again.");
  }
  return response;
 }
 const path=(id:string)=>{if(!uuid.test(id))throw new Error("Invalid media item.");return "/"+id;};
 return{
  async list(){const body=await(await request("")).json();return body.items;},
  async upload(file,replacing){
   const kind=file.type.startsWith("image/")?"image":file.type.startsWith("audio/")?"audio":file.type.startsWith("video/")?"video":null;
   if(!kind||!file.size||file.size>8*1024*1024)throw new Error("Choose an image, audio or video file no larger than 8 MiB.");
   if(replacing&&(!Number.isSafeInteger(replacing.revision)||replacing.revision<1))throw new Error("Refresh the media item before replacing it.");
   await request(replacing?path(replacing.id):"",{method:"POST",headers:{"content-type":file.type,"x-media-kind":kind,
    "x-media-filename":file.name,"x-media-rights-version":"media-rights-v1",...(replacing?{"if-match":String(replacing.revision)}:{})},body:file});
  },
  async playback(id){return(await request(path(id))).blob();},
  async revoke(id){await request(path(id),{method:"DELETE"});},
  async versions(id,before){
   if(before!==undefined&&(!Number.isSafeInteger(before)||before<1||before>2147483647))throw new Error("Invalid revision cursor.");
   return(await request(path(id)+"/versions"+(before===undefined?"":"?before="+before))).json();
  }
 };
}

