import {describe,it,expect} from 'vitest';
import {validateMediaSubmission} from './media-validation';
const id='11111111-1111-4111-8111-111111111111';
const valid={tenantId:id,ownerId:id,kind:'image' as const,mime:'image/png',bytes:123,sha256:'a'.repeat(64),filename:'model.png'};
describe('LC-11 media metadata gate',()=>{
 it('accepts bounded known metadata without claiming publication',()=>expect(validateMediaSubmission(valid).mime).toBe('image/png'));
 it('rejects executable MIME and malformed digest',()=>{
  expect(()=>validateMediaSubmission({...valid,mime:'text/html'})).toThrow('MEDIA_TYPE_FORBIDDEN');
  expect(()=>validateMediaSubmission({...valid,sha256:'bad'})).toThrow('MEDIA_DIGEST_REQUIRED');
 });
 it('rejects traversal and invalid tenant',()=>{
  expect(()=>validateMediaSubmission({...valid,filename:'../private'})).toThrow('MEDIA_FILENAME_INVALID');
  expect(()=>validateMediaSubmission({...valid,tenantId:'other'})).toThrow('MEDIA_ACTOR_INVALID');
 });
 it('rejects zero and oversized files',()=>{
  expect(()=>validateMediaSubmission({...valid,bytes:0})).toThrow('MEDIA_SIZE_FORBIDDEN');
  expect(()=>validateMediaSubmission({...valid,bytes:21*1024*1024})).toThrow('MEDIA_SIZE_FORBIDDEN');
 });
});
