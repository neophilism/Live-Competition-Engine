/** LC-18: producer selection proposal checks. Never an authorization to publish an event. */
export interface SelectionProposal{
 organizationId:string;competitionId:string;producerId:string;
 candidateId:string;reason:string;expectedVersion:number;
}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function validateSelectionProposal(p:SelectionProposal){
 if(!p||![p.organizationId,p.competitionId,p.producerId,p.candidateId].every(x=>typeof x==='string'&&UUID.test(x)))throw new Error('SELECTION_SCOPE_INVALID');
 if(p.producerId===p.candidateId)throw new Error('SELECTION_CONFLICT');
 if(typeof p.reason!=='string'||p.reason.trim().length<10||p.reason.length>2000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(p.reason))throw new Error('SELECTION_REASON_REQUIRED');
 if(!Number.isSafeInteger(p.expectedVersion)||p.expectedVersion<1)throw new Error('SELECTION_VERSION_REQUIRED');
 return Object.freeze({...p,reason:p.reason.trim()});
}
// Server must transactionally verify live tenant membership, producer permissions, candidate eligibility, conflict rules, current version and audit.
