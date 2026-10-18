/** LC-30 public history projection; only explicitly final published outcomes are visible. */
export interface ResultRevision{organizationId:string;competitionId:string;entryId:string;status:'provisional'|'final'|'void';rank:number|null;score:number|null;revision:number;publishedAt:string|null}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function publicResults(revisions:readonly ResultRevision[],organizationId:string,competitionId:string){
 if(!UUID.test(organizationId)||!UUID.test(competitionId)||!Array.isArray(revisions))throw new Error('RESULT_SCOPE_INVALID');
 const current=new Map<string,ResultRevision>();
 for(const r of revisions){
  if(!r||![r.organizationId,r.competitionId,r.entryId].every(x=>typeof x==='string'&&UUID.test(x)))throw new Error('RESULT_ID_INVALID');
  if(r.organizationId!==organizationId||r.competitionId!==competitionId)throw new Error('RESULT_CROSS_TENANT');
  if(!Number.isSafeInteger(r.revision)||r.revision<1)throw new Error('RESULT_REVISION_INVALID');
  if(r.rank!==null&&(!Number.isSafeInteger(r.rank)||r.rank<1))throw new Error('RESULT_RANK_INVALID');
  if(r.score!==null&&(!Number.isFinite(r.score)||r.score<0))throw new Error('RESULT_SCORE_INVALID');
  const old=current.get(r.entryId);
  if(old&&r.revision<=old.revision)throw new Error('RESULT_HISTORY_ORDER_INVALID');
  current.set(r.entryId,r);
 }
 return Object.freeze([...current.values()].filter(r=>r.status==='final'&&r.publishedAt!==null).map(r=>Object.freeze({
  entryId:r.entryId,rank:r.rank,score:r.score,revision:r.revision,publishedAt:r.publishedAt
 })).sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity)||(a.entryId<b.entryId?-1:a.entryId>b.entryId?1:0)));
}
// Only the authorized server may add revisions and mark publication; never infer finality from scoring.
