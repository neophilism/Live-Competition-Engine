import {describe,it,expect} from 'vitest';
import {remainingTimeMs,pauseTimer,resumeTimer} from './timer';
const s={startedAtMs:100000,durationMs:60000,accumulatedPauseMs:0};
describe('LC-24 authoritative timer',()=>{
 it('counts down only against passed trusted time',()=>{
  expect(remainingTimeMs(s,120000)).toBe(40000);
  expect(remainingTimeMs(s,190000)).toBe(0);
 });
 it('freezes on pause and resumes without time theft',()=>{
  const p=pauseTimer(s,120000);
  expect(remainingTimeMs(p,140000)).toBe(40000);
  const next=resumeTimer(p,140000);
  expect(remainingTimeMs(next,150000)).toBe(30000);
 });
 it('rejects impossible order and duplicate operations',()=>{
  expect(()=>remainingTimeMs(s,90000)).toThrow('TIMER_STATE_INVALID');
  expect(()=>resumeTimer(s,120000)).toThrow('TIMER_NOT_PAUSED');
  expect(()=>pauseTimer(pauseTimer(s,120000),130000)).toThrow('TIMER_ALREADY_PAUSED');
 });
});
