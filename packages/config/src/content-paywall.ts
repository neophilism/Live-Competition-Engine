/** LC-35 access decision from server-verified entitlement and source visibility. */
export type ContentVisibility='public'|'subscriber'|'purchase';
export interface ProtectedContent{organizationId:string;creatorId:string;contentId:string;visibility:ContentVisibility;published:boolean}
export interface VerifiedEntitlement{organizationId:string;creatorId:string;accountId:string;kind:'subscription'|'purchase';active:boolean;expiresAtMs:number;contentId?:string}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function contentMayBeRead(c:ProtectedContent,e:VerifiedEntitlement|null,nowMs:number){
 if(!c||![c.organizationId,c.creatorId,c.contentId].every(x=>typeof x==='string'&&UUID.test(x))||!['public','subscriber','purchase'].includes(c.visibility)||!Number.isSafeInteger(nowMs))throw new Error('CONTENT_POLICY_INVALID');
 if(!c.published)return false;
 if(c.visibility==='public')return true;
 if(!e||![e.organizationId,e.creatorId,e.accountId].every(x=>typeof x==='string'&&UUID.test(x))||e.organizationId!==c.organizationId||e.creatorId!==c.creatorId||!e.active||!Number.isSafeInteger(e.expiresAtMs)||e.expiresAtMs<=nowMs)return false;
 if(c.visibility==='subscriber')return e.kind==='subscription';
 return e.kind==='purchase'&&e.contentId===c.contentId;
}
// Entitlement must be loaded from trusted ledger/provider and current session; no signed URL or source asset is exposed by this function.
