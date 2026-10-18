import {describe,it,expect} from 'vitest';
import {validateGiftIntent} from './live-gifts';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const g={organizationId:a,eventId:a,senderId:a,recipientId:b,idempotencyKey:a,currency:'USD',minorUnits:100};
describe('LC-36 gifts preflight',()=>{
 it('preserves bounded minor-unit amount',()=>expect(validateGiftIntent(g).minorUnits).toBe(100));
 it('rejects self transfers and unbounded amounts',()=>{
  expect(()=>validateGiftIntent({...g,recipientId:a})).toThrow('GIFT_SELF_FORBIDDEN');
  expect(()=>validateGiftIntent({...g,minorUnits:100001})).toThrow('GIFT_AMOUNT_INVALID');
 });
 it('rejects bad idempotency and control characters',()=>{
  expect(()=>validateGiftIntent({...g,idempotencyKey:'bad'})).toThrow('GIFT_SCOPE_INVALID');
  expect(()=>validateGiftIntent({...g,message:'hello\nworld'})).toThrow('GIFT_MESSAGE_INVALID');
 });
});
