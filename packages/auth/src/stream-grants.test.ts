import {describe,it,expect} from 'vitest';
import {issueStreamGrant,verifyStreamGrant} from './stream-grants';
const id='11111111-1111-4111-8111-111111111111';
const key='private-fixture-signing-secret-not-for-production';
const grant={organizationId:id,eventId:id,accountId:id,issuedAt:1000,expiresAt:1100};
describe('LC-22 stream grants',()=>{
 it('binds account, event, tenant and expiry',()=>expect(verifyStreamGrant(issueStreamGrant(grant,key,1000),key,1001)).toEqual(grant));
 it('rejects tampering and wrong keys',()=>{
  const token=issueStreamGrant(grant,key,1000);
  expect(()=>verifyStreamGrant(token,'other-strong-fixture-key-not-production',1001)).toThrow('STREAM_SIGNATURE_INVALID');
  expect(()=>verifyStreamGrant(token+'x',key,1001)).toThrow('STREAM_SIGNATURE_INVALID');
 });
 it('rejects expiry, long lifetime and invalid scope',()=>{
  const token=issueStreamGrant(grant,key,1000);
  expect(()=>verifyStreamGrant(token,key,1100)).toThrow('STREAM_LIFETIME_INVALID');
  expect(()=>issueStreamGrant({...grant,expiresAt:1400},key,1000)).toThrow('STREAM_LIFETIME_INVALID');
  expect(()=>issueStreamGrant({...grant,eventId:'wrong'},key,1000)).toThrow('STREAM_SCOPE_INVALID');
 });
});
