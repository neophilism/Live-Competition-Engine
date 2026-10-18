import {describe,it,expect} from 'vitest';
import {validateCompetitionConfig} from './competition';
const valid={allowLateEntry:false,maxEntries:128,maxRounds:5,votingMethod:'judges' as const};
describe('LC-14 competition configuration',()=>{
 it('accepts bounded judge-only settings',()=>expect(validateCompetitionConfig(valid).maxEntries).toBe(128));
 it('rejects unreasonable competition sizes',()=>{
  expect(()=>validateCompetitionConfig({...valid,maxEntries:0})).toThrow('CONFIG_ENTRIES_INVALID');
  expect(()=>validateCompetitionConfig({...valid,maxRounds:129})).toThrow('CONFIG_ROUNDS_INVALID');
 });
 it('requires a strict hybrid weighting scheme',()=>{
  expect(()=>validateCompetitionConfig({...valid,votingMethod:'hybrid'})).toThrow('CONFIG_WEIGHT_INVALID');
  expect(()=>validateCompetitionConfig({...valid,votingMethod:'hybrid',audienceWeight:0.5}).audienceWeight).toBe(0.5);
 });
 it('rejects meaningless weight for judge-only contests',()=>expect(()=>validateCompetitionConfig({...valid,audienceWeight:0.5})).toThrow('CONFIG_WEIGHT_NOT_APPLICABLE'));
});
