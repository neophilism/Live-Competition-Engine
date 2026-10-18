import {describe,it,expect} from 'vitest';
import {validateAudienceVote,dedupeAudienceVotes} from './audience-voting';
const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
const v={organizationId:a,competitionId:a,roundId:a,entryId:a,voterId:b,roundVersion:1};
describe('LC-27 audience vote invariants',()=>{
 it('accepts one eligible identity tuple',()=>expect(dedupeAudienceVotes([v])).toHaveLength(1));
 it('rejects repeated ballot with changed entry',()=>expect(()=>dedupeAudienceVotes([v,{...v,entryId:b}])).toThrow('AUDIENCE_DUPLICATE_VOTE'));
 it('rejects forged malformed scope and invalid version',()=>{
  expect(()=>validateAudienceVote({...v,voterId:'invalid'})).toThrow('AUDIENCE_VOTE_SCOPE_INVALID');
  expect(()=>validateAudienceVote({...v,roundVersion:0})).toThrow('AUDIENCE_VOTE_ROUND_INVALID');
 });
});
