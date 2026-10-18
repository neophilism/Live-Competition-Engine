/** LC-28 deterministic sealed vote tally over authoritative deduplicated ballots. */
export interface Ballot{voterId:string;entryId:string;roundId:string;castAtMs:number}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function tallyRound(ballots:readonly Ballot[],roundId:string,opensAtMs:number,closesAtMs:number){
 if(!UUID.test(roundId)||!Number.isSafeInteger(opensAtMs)||!Number.isSafeInteger(closesAtMs)||opensAtMs>=closesAtMs)throw new Error('VOTE_WINDOW_INVALID');
 if(!Array.isArray(ballots)||ballots.length>1000000)throw new Error('VOTE_DATA_INVALID');
 const seen=new Set<string>(),counts=new Map<string,number>();
 for(const b of ballots){
  if(!b||![b.voterId,b.entryId,b.roundId].every(x=>typeof x==='string'&&UUID.test(x))||b.roundId!==roundId)throw new Error('VOTE_IDENTITY_INVALID');
  if(!Number.isSafeInteger(b.castAtMs)||b.castAtMs<opensAtMs||b.castAtMs>=closesAtMs)throw new Error('VOTE_WINDOW_CLOSED');
  if(seen.has(b.voterId))throw new Error('VOTE_DUPLICATE');seen.add(b.voterId);
  counts.set(b.entryId,(counts.get(b.entryId)??0)+1);
 }
 return Object.freeze([...counts.entries()].sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0).map(([entryId,votes])=>Object.freeze({entryId,votes})));
}
// Tally may be disclosed only after authorized release; live voter identifiers must remain private.
