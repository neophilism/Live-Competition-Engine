import {describe,it,expect} from 'vitest';
import {validateJudgeScore} from './judging-policy';
const a='11111111-1111-4111-8111-111111111111';
const input={organizationId:a,competitionId:a,roundId:a,entryId:a,judgeId:a,score:74,rubricVersion:1};
describe('LC-19 judge scoring preflight',()=>{
 it('accepts finite bounded score',()=>expect(validateJudgeScore(input).score).toBe(74));
 it('denies nonfinite or outside rubric range',()=>{
  for(const score of [NaN,Infinity,-1,101])expect(()=>validateJudgeScore({...input,score})).toThrow('JUDGE_SCORE_INVALID');
 });
 it('rejects invalid scope and rubric version',()=>{
  expect(()=>validateJudgeScore({...input,judgeId:'x'})).toThrow('JUDGE_SCOPE_INVALID');
  expect(()=>validateJudgeScore({...input,rubricVersion:0})).toThrow('JUDGE_RUBRIC_INVALID');
 });
});
