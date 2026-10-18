/** LC-17 preflight for individual entry applications; not persistence authorization. */
export interface RegistrationRequest{organizationId:string;competitionId:string;participantId:string;acceptRules:boolean;consentToPublicName:boolean}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function validateRegistrationRequest(r:RegistrationRequest){
 if(!r||![r.organizationId,r.competitionId,r.participantId].every(x=>typeof x==='string'&&UUID.test(x)))throw new Error('ENTRY_SCOPE_INVALID');
 if(r.acceptRules!==true)throw new Error('ENTRY_RULES_REQUIRED');
 if(typeof r.consentToPublicName!=='boolean')throw new Error('ENTRY_CONSENT_INVALID');
 return Object.freeze({...r});
}
/** Enrollment must recheck competition state, membership, duplicate entry, permissions and age/legal eligibility transactionally. */
