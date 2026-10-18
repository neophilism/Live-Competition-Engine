/** LC-19 independent judge scoring domain preflight (not authority proof). */
export interface JudgeScoreInput{
 organizationId:string;competitionId:string;roundId:string;entryId:string;
 judgeId:string;score:number;rubricVersion:number;notes?:string;
}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function validateJudgeScore(input:JudgeScoreInput){
 if(!input||![input.organizationId,input.competitionId,input.roundId,input.entryId,input.judgeId].every(x=>typeof x==='string'&&UUID.test(x)))throw new Error('JUDGE_SCOPE_INVALID');
 if(!Number.isFinite(input.score)||input.score<0||input.score>100)throw new Error('JUDGE_SCORE_INVALID');
 if(!Number.isSafeInteger(input.rubricVersion)||input.rubricVersion<1)throw new Error('JUDGE_RUBRIC_INVALID');
 if(input.notes!==undefined&&(typeof input.notes!=='string'||input.notes.length>2048||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(input.notes)))throw new Error('JUDGE_NOTES_INVALID');
 return Object.freeze({...input});
}
/** Authoritative save must verify unconflicted active judge grant scoped to this tenant and competition,
 * scoreable live round, current rubric, immutable audit and one submission per judge/entry/version.
 * Do not reveal per-judge secret scores before the configured release event.
 */
