import {describe,it,expect} from 'vitest';
import {allocateRevenue} from './revenue-split';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const shares=[{recipientId:a,basisPoints:5000},{recipientId:b,basisPoints:5000}];
describe('LC-32 exact revenue split',()=>{
 it('never creates or loses minor units',()=>expect(allocateRevenue(101,shares).reduce((s,r)=>s+r.minorUnits,0)).toBe(101));
 it('deterministically assigns single-cent tie residue',()=>expect(allocateRevenue(1,shares)).toEqual([
  {recipientId:a,basisPoints:5000,minorUnits:1},{recipientId:b,basisPoints:5000,minorUnits:0}
 ]));
 it('rejects unsafe amount, duplicate recipients and unbalanced allocation',()=>{
  expect(()=>allocateRevenue(1.5,shares)).toThrow('SPLIT_AMOUNT_INVALID');
  expect(()=>allocateRevenue(100,[shares[0],shares[0]])).toThrow('SPLIT_SHARE_INVALID');
  expect(()=>allocateRevenue(100,[{recipientId:a,basisPoints:9000}])).toThrow('SPLIT_TOTAL_INVALID');
 });
});
