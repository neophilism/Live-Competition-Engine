import {describe,it,expect} from 'vitest';
import {publicResults} from './results-history';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const r={organizationId:a,competitionId:a,entryId:b,status:'provisional' as const,rank:1,score:90,revision:1,publishedAt:null};
describe('LC-30 public results',()=>{
 it('hides unpublished and provisional results',()=>expect(publicResults([r],a,a)).toEqual([]));
 it('shows only exact final published revision',()=>{
  const final={...r,status:'final' as const,revision:2,publishedAt:'2026-10-18T00:00:00Z'};
  expect(publicResults([r,final],a,a)).toEqual([{entryId:b,rank:1,score:90,revision:2,publishedAt:final.publishedAt}]);
 });
 it('rejects cross-tenant history and nonmonotone revisions',()=>{
  expect(()=>publicResults([{...r,organizationId:b}],a,a)).toThrow('RESULT_CROSS_TENANT');
  expect(()=>publicResults([r,r],a,a)).toThrow('RESULT_HISTORY_ORDER_INVALID');
 });
});
