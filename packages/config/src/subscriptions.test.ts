import {describe,it,expect} from 'vitest';
import {validateSubscription,subscriptionWindowActive} from './subscriptions';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const v={organizationId:a,creatorId:a,subscriberId:b,planId:a,status:'active' as const,startsAtMs:100,endsAtMs:200};
describe('LC-34 subscription windows',()=>{
 it('allows only active or trialing interval',()=>{
  expect(subscriptionWindowActive(v,150)).toBe(true);
  expect(subscriptionWindowActive({...v,status:'past_due'},150)).toBe(false);
  expect(subscriptionWindowActive(v,200)).toBe(false);
 });
 it('rejects invalid tenant scope, self-subscribing and invalid intervals',()=>{
  expect(()=>validateSubscription({...v,organizationId:'bad'})).toThrow('SUBSCRIPTION_SCOPE_INVALID');
  expect(()=>validateSubscription({...v,subscriberId:a})).toThrow('SUBSCRIPTION_SELF_INVALID');
  expect(()=>validateSubscription({...v,startsAtMs:201})).toThrow('SUBSCRIPTION_DATES_INVALID');
 });
});
