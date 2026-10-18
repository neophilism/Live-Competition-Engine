import {describe,it,expect} from 'vitest';
import {validateRegistrationRequest} from './registration-policy';
const org='11111111-1111-4111-8111-111111111111';
const r={organizationId:org,competitionId:org,participantId:org,acceptRules:true,consentToPublicName:false};
describe('LC-17 entry registration boundary',()=>{
 it('accepts explicit private-name choice',()=>expect(validateRegistrationRequest(r).consentToPublicName).toBe(false));
 it('rejects absent rules acknowledgement',()=>expect(()=>validateRegistrationRequest({...r,acceptRules:false})).toThrow('ENTRY_RULES_REQUIRED'));
 it('rejects invalid scope or implied consent',()=>{
  expect(()=>validateRegistrationRequest({...r,competitionId:'nope'})).toThrow('ENTRY_SCOPE_INVALID');
  expect(()=>validateRegistrationRequest({...r,consentToPublicName:undefined as never})).toThrow('ENTRY_CONSENT_INVALID');
 });
});
