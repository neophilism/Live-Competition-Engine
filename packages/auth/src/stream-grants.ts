import {createHmac,timingSafeEqual} from 'node:crypto';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export interface StreamGrant{organizationId:string;eventId:string;accountId:string;issuedAt:number;expiresAt:number}
function guard(g:StreamGrant,now:number){
 if(![g.organizationId,g.eventId,g.accountId].every(x=>typeof x==='string'&&UUID.test(x)))throw new Error('STREAM_SCOPE_INVALID');
 if(!Number.isSafeInteger(g.issuedAt)||!Number.isSafeInteger(g.expiresAt)||g.issuedAt>now+30||g.expiresAt<=now||g.expiresAt-g.issuedAt>300)throw new Error('STREAM_LIFETIME_INVALID');
}
function key(secret:string){if(typeof secret!=='string'||secret.length<32)throw new Error('STREAM_KEY_INVALID');return secret}
function hmac(message:string,secret:string){return createHmac('sha256',key(secret)).update('lce-stream-v1\0'+message).digest('base64url')}
export function issueStreamGrant(grant:StreamGrant,secret:string,now=Math.floor(Date.now()/1000)){
 guard(grant,now);
 const encoded=Buffer.from(JSON.stringify(grant),'utf8').toString('base64url');
 return encoded+'.'+hmac(encoded,secret);
}
export function verifyStreamGrant(token:string,secret:string,now=Math.floor(Date.now()/1000)):StreamGrant{
 if(typeof token!=='string'||token.length>2048||!(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/).test(token))throw new Error('STREAM_TOKEN_INVALID');
 const [encoded,mac]=token.split('.');
 const expected=Buffer.from(hmac(encoded!,secret),'base64url'),presented=Buffer.from(mac!,'base64url');
 if(presented.length!==expected.length||!timingSafeEqual(presented,expected))throw new Error('STREAM_SIGNATURE_INVALID');
 let g:unknown;
 try{g=JSON.parse(Buffer.from(encoded!,'base64url').toString('utf8'))}catch{throw new Error('STREAM_TOKEN_INVALID')}
 if(!g||typeof g!=='object'||Array.isArray(g)||Object.keys(g).sort().join(',')!=='accountId,eventId,expiresAt,issuedAt,organizationId')throw new Error('STREAM_TOKEN_INVALID');
 const grant=g as StreamGrant;guard(grant,now);
 return grant;
}
// Verified grant must additionally be rechecked against live session, tenant membership and event visibility on each stream connection.
