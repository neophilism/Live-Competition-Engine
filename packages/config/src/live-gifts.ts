/** LC-36 tip/gift intent preflight; not a payment, transfer, or creator entitlement. */
export interface GiftIntent{organizationId:string;eventId:string;senderId:string;recipientId:string;currency:string;minorUnits:number;message?:string;idempotencyKey:string}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function validateGiftIntent(g:GiftIntent){
 if(!g||![g.organizationId,g.eventId,g.senderId,g.recipientId,g.idempotencyKey].every(x=>typeof x==='string'&&UUID.test(x)))throw new Error('GIFT_SCOPE_INVALID');
 if(g.senderId===g.recipientId)throw new Error('GIFT_SELF_FORBIDDEN');
 if(!(/^[A-Z]{3}$/).test(g.currency)||!Number.isSafeInteger(g.minorUnits)||g.minorUnits<1||g.minorUnits>100000)throw new Error('GIFT_AMOUNT_INVALID');
 if(g.message!==undefined&&(typeof g.message!=='string'||g.message.length>280||/[\x00-\x1f]/.test(g.message)))throw new Error('GIFT_MESSAGE_INVALID');
 return Object.freeze({...g});
}
// Payment and gift delivery require verified adult/eligibility rules, trusted sender and recipient accounts,
// fraud/rate limits, a unique idempotency row, provider settlement and explicit recipient consent.
