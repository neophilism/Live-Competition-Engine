import {describe,it,expect} from 'vitest';
import {signVoteReceipt,verifyVoteReceipt} from './vote-integrity';
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const r={organizationId:id,roundId:id,voterId:id,entryId:other,castAt:1000,sequence:1},key='test-fixture-integrity-secret-do-not-use-in-production';
describe('LC-29 signed receipt proof',()=>{
 it('verifies canonical receipt fields',()=>expect(verifyVoteReceipt(r,signVoteReceipt(r,key),key)).toBe(true));
 it('rejects changed entry/sequence or key',()=>{
  const sig=signVoteReceipt(r,key);
  expect(()=>verifyVoteReceipt({...r,entryId:id},sig,key)).toThrow('VOTE_RECEIPT_SIGNATURE_INVALID');
  expect(()=>verifyVoteReceipt({...r,sequence:2},sig,key)).toThrow('VOTE_RECEIPT_SIGNATURE_INVALID');
 });
 it('rejects malformed scope and signature',()=>{
  expect(()=>signVoteReceipt({...r,voterId:'fake'},key)).toThrow('VOTE_RECEIPT_SCOPE_INVALID');
  expect(()=>verifyVoteReceipt(r,'abcd',key)).toThrow('VOTE_RECEIPT_SIGNATURE_INVALID');
 });
});
