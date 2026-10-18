import {describe,it,expect} from 'vitest';
import {validateBackstageTransition} from './backstage';
const id='11111111-1111-4111-8111-111111111111';
const start={organizationId:id,competitionId:id,entryId:id,from:'invited' as const,to:'checked_in' as const,expectedVersion:1};
describe('LC-23 backstage transitions',()=>{
 it('permits checked-in arrival',()=>expect(validateBackstageTransition(start).to).toBe('checked_in'));
 it('rejects skipped or terminal stage moves',()=>{
  expect(()=>validateBackstageTransition({...start,to:'on_stage'})).toThrow('BACKSTAGE_TRANSITION_INVALID');
  expect(()=>validateBackstageTransition({...start,from:'finished',to:'ready'})).toThrow('BACKSTAGE_TRANSITION_INVALID');
 });
 it('requires reason for withdrawal and valid version',()=>{
  expect(()=>validateBackstageTransition({...start,to:'withdrawn'})).toThrow('BACKSTAGE_WITHDRAWAL_REASON');
  expect(()=>validateBackstageTransition({...start,expectedVersion:0})).toThrow('BACKSTAGE_VERSION_INVALID');
 });
});
