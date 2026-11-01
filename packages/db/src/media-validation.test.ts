import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {validateMediaSubmission} from './media-validation.ts';
const id='11111111-1111-4111-8111-111111111111';
const valid={tenantId:id,ownerId:id,kind:'image' as const,mime:'image/png',bytes:123,sha256:'a'.repeat(64),filename:'model.png'};
describe('LC-11 media metadata gate',()=>{
 it('accepts bounded known metadata without claiming publication',()=>assert.equal(validateMediaSubmission(valid).mime,'image/png'));
 it('rejects executable MIME and malformed digest',()=>{
  assert.throws(()=>validateMediaSubmission({...valid,mime:'text/html'}), /MEDIA_TYPE_FORBIDDEN/);
  assert.throws(()=>validateMediaSubmission({...valid,sha256:'bad'}), /MEDIA_DIGEST_REQUIRED/);
 });
 it('rejects traversal and invalid tenant',()=>{
  assert.throws(()=>validateMediaSubmission({...valid,filename:'../private'}), /MEDIA_FILENAME_INVALID/);
  assert.throws(()=>validateMediaSubmission({...valid,tenantId:'other'}), /MEDIA_ACTOR_INVALID/);
 });
 it('rejects zero and oversized files',()=>{
  assert.throws(()=>validateMediaSubmission({...valid,bytes:0}), /MEDIA_SIZE_FORBIDDEN/);
  assert.throws(()=>validateMediaSubmission({...valid,bytes:21*1024*1024}), /MEDIA_SIZE_FORBIDDEN/);
 });
});

