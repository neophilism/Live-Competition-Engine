/** LC-20 immutable scoring math for verified judge submissions; not a publish authorization. */
export interface WeightedCriterion{key:string;weight:number;maxScore:number}
const KEY=/^[a-z][a-z0-9_-]{0,63}$/;
export function validateScoringRubric(criteria:readonly WeightedCriterion[]){
 if(!Array.isArray(criteria)||!criteria.length||criteria.length>24)throw new Error('SCORING_CRITERIA_INVALID');
 const seen=new Set<string>();let total=0;
 for(const c of criteria){
  if(!c||typeof c.key!=='string'||!KEY.test(c.key)||seen.has(c.key))throw new Error('SCORING_KEY_INVALID');
  if(!Number.isFinite(c.weight)||c.weight<=0||c.weight>1||!Number.isFinite(c.maxScore)||c.maxScore<=0||c.maxScore>1000)throw new Error('SCORING_VALUE_INVALID');
  seen.add(c.key);total+=c.weight;
 }
 if(Math.abs(total-1)>1e-9)throw new Error('SCORING_WEIGHTS_INVALID');
 return Object.freeze(criteria.map(c=>Object.freeze({...c})));
}
export function calculateWeightedScore(rubric:readonly WeightedCriterion[],scores:Readonly<Record<string,number>>){
 const validated=validateScoringRubric(rubric);
 if(Object.keys(scores).length!==validated.length)throw new Error('SCORING_SUBMISSION_INCOMPLETE');
 let total=0;
 for(const c of validated){
  const v=scores[c.key];
  if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>c.maxScore)throw new Error('SCORING_SUBMISSION_INVALID');
  total+=c.weight*(v/c.maxScore)*100;
 }
 return Math.round((total+Number.EPSILON)*10000)/10000;
}
// Server must bind published rubric revision and authorized judge to each immutable scored result.
