import {describe,it,expect} from 'vitest';
import {contentMayBeRead} from './content-paywall';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const content={organizationId:a,creatorId:a,contentId:a,visibility:'subscriber' as const,published:true};
const grant={organizationId:a,creatorId:a,accountId:b,kind:'subscription' as const,active:true,expiresAtMs:200};
describe('LC-35 paywall decisions',()=>{
 it('denies unpublished content even with entitlement',()=>expect(contentMayBeRead({...content,published:false},grant,100)).toBe(false));
 it('allows valid subscriber and denies expired/cross-tenant',()=>{
  expect(contentMayBeRead(content,grant,100)).toBe(true);
  expect(contentMayBeRead(content,{...grant,expiresAtMs:100},100)).toBe(false);
  expect(contentMayBeRead(content,{...grant,organizationId:b},100)).toBe(false);
 });
 it('requires content-specific purchase',()=>{
  expect(contentMayBeRead({...content,visibility:'purchase'},grant,100)).toBe(false);
  expect(contentMayBeRead({...content,visibility:'purchase'},{...grant,kind:'purchase',contentId:a},100)).toBe(true);
 });
});
