import {describe,it,expect} from 'vitest';
import {validateFollowRequest} from './follow-policy';
const id='11111111-1111-4111-8111-111111111111',id2='22222222-2222-4222-8222-222222222222';
const request={tenantId:id,followerId:id,subjectId:id2,subject:'event' as const,visibility:'public' as const};
describe('LC-12 follow policy',()=>{
 it('permits a bounded public relationship',()=>expect(validateFollowRequest(request).subject).toBe('event'));
 it('rejects self and missing tenant identity',()=>{
  expect(()=>validateFollowRequest({...request,subjectId:id})).toThrow('FOLLOW_SELF_FORBIDDEN');
  expect(()=>validateFollowRequest({...request,tenantId:'bad'})).toThrow('FOLLOW_ID_INVALID');
 });
 it('requires private consent and denies blocked target',()=>{
  expect(()=>validateFollowRequest({...request,visibility:'private'})).toThrow('FOLLOW_CONSENT_REQUIRED');
  expect(()=>validateFollowRequest({...request,blocked:true})).toThrow('FOLLOW_BLOCKED');
 });
});
