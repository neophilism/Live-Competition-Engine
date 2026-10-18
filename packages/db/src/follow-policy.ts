/** LC-12 tenant-scoped follow relationship decision logic. */
export type FollowSubject='event'|'creator'|'organization';
export interface FollowRequest{tenantId:string;followerId:string;subjectId:string;subject:FollowSubject;visibility:'public'|'private';blocked?:boolean;consented?:boolean}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function validateFollowRequest(value:FollowRequest){
 if(!value||![value.tenantId,value.followerId,value.subjectId].every(x=>typeof x==='string'&&UUID.test(x)))throw new Error('FOLLOW_ID_INVALID');
 if(value.followerId===value.subjectId)throw new Error('FOLLOW_SELF_FORBIDDEN');
 if(!['event','creator','organization'].includes(value.subject))throw new Error('FOLLOW_TARGET_INVALID');
 if(value.blocked)throw new Error('FOLLOW_BLOCKED');
 if(value.visibility!=='public'&&value.visibility!=='private')throw new Error('FOLLOW_VISIBILITY_INVALID');
 if(value.visibility==='private'&&!value.consented)throw new Error('FOLLOW_CONSENT_REQUIRED');
 return Object.freeze({...value});
}
// Authorization still requires membership and block-list checks against the database.
