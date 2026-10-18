/** LC-34 creator subscription eligibility; processor acceptance and access control stay server-side. */
export interface CreatorSubscription{organizationId:string;creatorId:string;subscriberId:string;planId:string;status:'trialing'|'active'|'past_due'|'cancelled'|'expired';startsAtMs:number;endsAtMs:number}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function validateSubscription(s:CreatorSubscription){
 if(!s||![s.organizationId,s.creatorId,s.subscriberId,s.planId].every(x=>typeof x==='string'&&UUID.test(x)))throw new Error('SUBSCRIPTION_SCOPE_INVALID');
 if(s.creatorId===s.subscriberId)throw new Error('SUBSCRIPTION_SELF_INVALID');
 if(!['trialing','active','past_due','cancelled','expired'].includes(s.status))throw new Error('SUBSCRIPTION_STATUS_INVALID');
 if(!Number.isSafeInteger(s.startsAtMs)||!Number.isSafeInteger(s.endsAtMs)||s.startsAtMs>=s.endsAtMs)throw new Error('SUBSCRIPTION_DATES_INVALID');
 return Object.freeze({...s});
}
export function subscriptionWindowActive(s:CreatorSubscription,serverNowMs:number){
 validateSubscription(s);
 if(!Number.isSafeInteger(serverNowMs))throw new Error('SUBSCRIPTION_TIME_INVALID');
 return (s.status==='active'||s.status==='trialing')&&serverNowMs>=s.startsAtMs&&serverNowMs<s.endsAtMs;
}
// Never infer payment or authorization from this view: recheck provider, revocation and tenant membership on every protected access.
