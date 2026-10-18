import {describe,it,expect} from 'vitest';
import {validateScoringRubric,calculateWeightedScore} from './scoring';
const criteria=[{key:'technique',weight:0.6,maxScore:10},{key:'creativity',weight:0.4,maxScore:20}];
describe('LC-20 weighted scoring',()=>{
 it('computes normalized weighted result deterministically',()=>expect(calculateWeightedScore(criteria,{technique:8,creativity:10})).toBe(68));
 it('rejects invalid weights and duplicate criterion',()=>{
  expect(()=>validateScoringRubric([{key:'a',weight:0.5,maxScore:10}])).toThrow('SCORING_WEIGHTS_INVALID');
  expect(()=>validateScoringRubric([{key:'a',weight:0.5,maxScore:10},{key:'a',weight:0.5,maxScore:10}])).toThrow('SCORING_KEY_INVALID');
 });
 it('rejects missing and out-of-range scores',()=>{
  expect(()=>calculateWeightedScore(criteria,{technique:9})).toThrow('SCORING_SUBMISSION_INCOMPLETE');
  expect(()=>calculateWeightedScore(criteria,{technique:11,creativity:10})).toThrow('SCORING_SUBMISSION_INVALID');
 });
});
