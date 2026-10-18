import {describe,it,expect} from 'vitest';
import {validateStagePlan} from './stages';
const a={id:'round1',ordinal:1,kind:'solo' as const,capacity:8,advances:4};
describe('LC-15 stage blueprint',()=>{
 it('accepts a valid ordered plan',()=>expect(validateStagePlan([a])).toHaveLength(1));
 it('rejects duplicate stage ids and skipped ordinal',()=>{
  expect(()=>validateStagePlan([a,{...a,ordinal:2}])).toThrow('STAGE_ID_INVALID');
  expect(()=>validateStagePlan([{...a,ordinal:2}])).toThrow('STAGE_ORDER_INVALID');
 });
 it('rejects invalid advances and final progression',()=>{
  expect(()=>validateStagePlan([{...a,advances:9}])).toThrow('STAGE_ADVANCE_INVALID');
  expect(()=>validateStagePlan([{...a,kind:'final',advances:1}])).toThrow('STAGE_FINAL_ADVANCES');
 });
 it('enforces head-to-head capacity',()=>expect(()=>validateStagePlan([{...a,kind:'head_to_head'}])).toThrow('STAGE_HEAD_TO_HEAD_CAPACITY'));
});
