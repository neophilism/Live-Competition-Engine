/** LC-21 enforce constrained critique payloads prior to privileged persistence. */
export interface Critique{organizationId:string;competitionId:string;entryId:string;authorId:string;body:string;visibility:'private_to_entrant'|'public_after_results';acknowledgeCodeOfConduct:boolean}
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function validateCritique(c:Critique){
 if(!c||![c.organizationId,c.competitionId,c.entryId,c.authorId].every(x=>typeof x==='string'&&ID.test(x)))throw new Error('CRITIQUE_SCOPE_INVALID');
 if(!['private_to_entrant','public_after_results'].includes(c.visibility))throw new Error('CRITIQUE_VISIBILITY_INVALID');
 if(!c.acknowledgeCodeOfConduct)throw new Error('CRITIQUE_CONDUCT_REQUIRED');
 if(typeof c.body!=='string'||c.body.trim().length<10||c.body.length>4000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(c.body))throw new Error('CRITIQUE_BODY_INVALID');
 return Object.freeze({...c,body:c.body.trim()});
}
// Moderation, session authorization, author/entrant privacy and publication locks are server/database responsibilities.
