import {describe,it,expect} from 'vitest';
import {validateSelectionProposal} from './producer-selection';
const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
const data={organizationId:a,competitionId:a,producerId:a,candidateId:b,reason:'Synthetic approved shortlisting review',expectedVersion:1};
describe('LC-18 producer preflight',()=>{
 it('accepts explicit review reason with version fence',()=>expect(validateSelectionProposal(data).expectedVersion).toBe(1));
 it('rejects an invalid tenant or overlapping producer/candidate',()=>{
  expect(()=>validateSelectionProposal({...data,organizationId:'bad'})).toThrow('SELECTION_SCOPE_INVALID');
  expect(()=>validateSelectionProposal({...data,candidateId:a})).toThrow('SELECTION_CONFLICT');
 });
 it('rejects absent reasons and stale version fence',()=>{
  expect(()=>validateSelectionProposal({...data,reason:''})).toThrow('SELECTION_REASON_REQUIRED');
  expect(()=>validateSelectionProposal({...data,expectedVersion:0})).toThrow('SELECTION_VERSION_REQUIRED');
 });
});
