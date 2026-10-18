import {describe,it,expect} from 'vitest';
import {tallyRound} from './voting-engine';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const ballot={voterId:a,entryId:b,roundId:a,castAtMs:110};
describe('LC-28 vote tally',()=>{
 it('counts a valid sealed ballot',()=>expect(tallyRound([ballot],a,100,200)).toEqual([{entryId:b,votes:1}]));
 it('rejects duplicate voter even if entry changes',()=>expect(()=>tallyRound([ballot,{...ballot,entryId:a}],a,100,200)).toThrow('VOTE_DUPLICATE'));
 it('rejects late, wrong round and invalid window',()=>{
  expect(()=>tallyRound([{...ballot,castAtMs:200}],a,100,200)).toThrow('VOTE_WINDOW_CLOSED');
  expect(()=>tallyRound([{...ballot,roundId:b}],a,100,200)).toThrow('VOTE_IDENTITY_INVALID');
  expect(()=>tallyRound([],a,200,100)).toThrow('VOTE_WINDOW_INVALID');
 });
});
