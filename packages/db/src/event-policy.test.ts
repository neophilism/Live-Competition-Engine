import {describe,it,expect} from 'vitest';
import {mayTransition,validateEventDraft} from './event-policy';
const draft={organizationId:'11111111-1111-4111-8111-111111111111',title:' Contest '};
describe('LC-13 event rules',()=>{
 it('validates and trims benign draft',()=>expect(validateEventDraft(draft).title).toBe('Contest'));
 it('rejects invalid tenancy and dangerous title',()=>{
  expect(()=>validateEventDraft({...draft,organizationId:'unknown'})).toThrow('EVENT_ORGANIZATION_REQUIRED');
  expect(()=>validateEventDraft({...draft,title:'<script>'})).toThrow('EVENT_TITLE_INVALID');
 });
 it('requires valid ordered times',()=>expect(()=>validateEventDraft({...draft,startsAt:'2026-11-01',endsAt:'2026-10-01'})).toThrow('EVENT_SCHEDULE_INVALID'));
 it('denies illegal terminal or skipped transitions',()=>{
  expect(mayTransition('draft','live')).toBe(false);
  expect(mayTransition('completed','live')).toBe(false);
  expect(mayTransition('draft','published')).toBe(true);
 });
});
