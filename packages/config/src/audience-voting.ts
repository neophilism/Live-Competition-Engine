/** LC-27 audience vote domain rules; caller must verify current session and eligibility in database. */
export interface AudienceVote{organizationId:string;competitionId:string;roundId:string;entryId:string;voterId:string;roundVersion:number}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function validateAudienceVote(v:AudienceVote){
 if(!v||![v.organizationId,v.competitionId,v.roundId,v.entryId,v.voterId].every(x=>typeof x==='string'&&UUID.test(x)))throw new Error('AUDIENCE_VOTE_SCOPE_INVALID');
 if(!Number.isSafeInteger(v.roundVersion)||v.roundVersion<1)throw new Error('AUDIENCE_VOTE_ROUND_INVALID');
 return Object.freeze({...v});
}
export function voteKey(v:AudienceVote){validateAudienceVote(v);return JSON.stringify([v.organizationId,v.competitionId,v.roundId,v.voterId]);}
export function dedupeAudienceVotes(votes:readonly AudienceVote[]){
 const seen=new Set<string>();const out:AudienceVote[]=[];
 for(const v of votes){const key=voteKey(v);if(seen.has(key))throw new Error('AUDIENCE_DUPLICATE_VOTE');seen.add(key);out.push(v);}
 return Object.freeze(out);
}
// Never trust a client voter ID; derive from authenticated principal and prevent replay transactionally.
