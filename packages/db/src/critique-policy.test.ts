import {describe,it,expect} from 'vitest';
import {validateCritique} from './critique-policy';
const id='11111111-1111-4111-8111-111111111111';
const c={organizationId:id,competitionId:id,entryId:id,authorId:id,body:'Clear and actionable feedback',visibility:'private_to_entrant' as const,acknowledgeCodeOfConduct:true};
describe('LC-21 critique policy',()=>{
 it('keeps private feedback separate from public release',()=>expect(validateCritique(c).visibility).toBe('private_to_entrant'));
 it('rejects invalid tenant scope or unsafe visibility',()=>{
  expect(()=>validateCritique({...c,organizationId:'no'})).toThrow('CRITIQUE_SCOPE_INVALID');
  expect(()=>validateCritique({...c,visibility:'world' as never})).toThrow('CRITIQUE_VISIBILITY_INVALID');
 });
 it('requires conduct acknowledgement and meaningful text',()=>{
  expect(()=>validateCritique({...c,acknowledgeCodeOfConduct:false})).toThrow('CRITIQUE_CONDUCT_REQUIRED');
  expect(()=>validateCritique({...c,body:'short'})).toThrow('CRITIQUE_BODY_INVALID');
 });
});
