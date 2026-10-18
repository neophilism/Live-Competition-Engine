import {createHmac,timingSafeEqual} from 'node:crypto';
/** LC-29 authenticity envelope for already-authorized, server-issued vote receipts.
 * A signature is not voter eligibility and does not replace DB uniqueness/transaction.
 */
export interface VoteReceipt{organizationId:string;roundId:string;voterId:string;entryId:string;castAt:number;sequence:number}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function validate(x:VoteReceipt){
 if(!x||![x.organizationId,x.roundId,x.voterId,x.entryId].every(v=>typeof v==='string'&&UUID.test(v)))throw new Error('VOTE_RECEIPT_SCOPE_INVALID');
 if(!Number.isSafeInteger(x.castAt)||x.castAt<1||!Number.isSafeInteger(x.sequence)||x.sequence<1)throw new Error('VOTE_RECEIPT_TIME_INVALID');
}
function secret(k:string){if(typeof k!=='string'||k.length<32)throw new Error('VOTE_RECEIPT_KEY_INVALID');return k}
function message(x:VoteReceipt){return JSON.stringify([x.organizationId,x.roundId,x.voterId,x.entryId,x.castAt,x.sequence])}
export function signVoteReceipt(x:VoteReceipt,key:string){validate(x);return createHmac('sha256',secret(key)).update('lce-vote-receipt-v1\0'+message(x)).digest('hex')}
export function verifyVoteReceipt(x:VoteReceipt,signature:string,key:string){
 validate(x);if(typeof signature!=='string'||!(/^[a-f0-9]{64}$/i).test(signature))throw new Error('VOTE_RECEIPT_SIGNATURE_INVALID');
 const a=Buffer.from(signature,'hex'),b=Buffer.from(signVoteReceipt(x,key),'hex');
 if(!timingSafeEqual(a,b))throw new Error('VOTE_RECEIPT_SIGNATURE_INVALID');
 return true;
}
// Verify against immutable stored vote event and current credential/key version; never trust client-supplied voterId.
