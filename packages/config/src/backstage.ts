/** LC-23 performer green-room transition plan.
 * A stage manager's server must still verify tenant membership, active event and live revocations.
 */
export type BackstageState='invited'|'checked_in'|'ready'|'on_stage'|'finished'|'withdrawn';
const NEXT:Readonly<Record<BackstageState,readonly BackstageState[]>>={
 invited:['checked_in','withdrawn'],checked_in:['ready','withdrawn'],ready:['on_stage','withdrawn'],
 on_stage:['finished'],finished:[],withdrawn:[]
};
export interface BackstageTransition{organizationId:string;competitionId:string;entryId:string;from:BackstageState;to:BackstageState;expectedVersion:number;reason?:string}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function validateBackstageTransition(t:BackstageTransition){
 if(!t||![t.organizationId,t.competitionId,t.entryId].every(x=>typeof x==='string'&&UUID.test(x)))throw new Error('BACKSTAGE_SCOPE_INVALID');
 if(!Object.hasOwn(NEXT,t.from)||!NEXT[t.from].includes(t.to))throw new Error('BACKSTAGE_TRANSITION_INVALID');
 if(!Number.isSafeInteger(t.expectedVersion)||t.expectedVersion<1)throw new Error('BACKSTAGE_VERSION_INVALID');
 if(t.to==='withdrawn'&&(!t.reason||t.reason.trim().length<10||t.reason.length>1024))throw new Error('BACKSTAGE_WITHDRAWAL_REASON');
 return Object.freeze({...t});
}
// Server must atomically fence current entry/version and producer permissions before moving to on_stage.
