/** LC-15 deterministic stage blueprint validation, not a published stage API. */
export type StageKind='solo'|'head_to_head'|'group'|'final';
export interface StageInput{id:string;ordinal:number;kind:StageKind;advances:number;capacity:number}
const ID=/^[a-z][a-z0-9_-]{0,63}$/;
export function validateStagePlan(stages:readonly StageInput[]){
 if(!Array.isArray(stages)||stages.length<1||stages.length>128)throw new Error('STAGES_COUNT_INVALID');
 const ids=new Set<string>();
 return Object.freeze(stages.map((s,index)=>{
  if(!s||!ID.test(s.id)||ids.has(s.id))throw new Error('STAGE_ID_INVALID');ids.add(s.id);
  if(!Number.isSafeInteger(s.ordinal)||s.ordinal!==index+1)throw new Error('STAGE_ORDER_INVALID');
  if(!['solo','head_to_head','group','final'].includes(s.kind))throw new Error('STAGE_KIND_INVALID');
  if(!Number.isSafeInteger(s.capacity)||s.capacity<1||s.capacity>100000)throw new Error('STAGE_CAPACITY_INVALID');
  if(!Number.isSafeInteger(s.advances)||s.advances<0||s.advances>s.capacity)throw new Error('STAGE_ADVANCE_INVALID');
  if(s.kind==='head_to_head'&&s.capacity!==2)throw new Error('STAGE_HEAD_TO_HEAD_CAPACITY');
  if(s.kind==='final'&&s.advances!==0)throw new Error('STAGE_FINAL_ADVANCES');
  return Object.freeze({...s});
 }));
}
