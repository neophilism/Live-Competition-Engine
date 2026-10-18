/** LC-16 deterministic single-elimination bracket model for synthetic seeding. */
export interface BracketPair{round:number;slot:number;left:string;right:string}
const ID=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
export function createOpeningBracket(ids:readonly string[]):readonly BracketPair[]{
 if(!Array.isArray(ids)||ids.length<2||ids.length>1024||(ids.length&(ids.length-1))!==0)throw new Error('BRACKET_SIZE_INVALID');
 const seen=new Set<string>();
 for(const id of ids){if(typeof id!=='string'||!ID.test(id)||seen.has(id))throw new Error('BRACKET_SEED_INVALID');seen.add(id)}
 return Object.freeze(Array.from({length:ids.length/2},(_,slot)=>Object.freeze({
  round:1,slot:slot+1,left:ids[slot*2]!,right:ids[slot*2+1]!
 })));
}
export function validateBracketWinner(pair:BracketPair,winnerId:string){
 if(winnerId!==pair.left&&winnerId!==pair.right)throw new Error('BRACKET_WINNER_INVALID');
 return winnerId;
}
// Advancing winners requires independently authorized immutable outcome and audit evidence.
