/** LC-24: server-time evaluation of persisted timed stages. Client countdown is never authoritative. */
export interface TimerSnapshot{startedAtMs:number;durationMs:number;pausedAtMs?:number;accumulatedPauseMs:number}
function safe(n:number){return Number.isSafeInteger(n)&&n>=0}
function guard(s:TimerSnapshot,now:number){
 if(!safe(s.startedAtMs)||!safe(s.durationMs)||s.durationMs<1000||s.durationMs>86400000||!safe(s.accumulatedPauseMs)||!safe(now)||now<s.startedAtMs)throw new Error('TIMER_STATE_INVALID');
 if(s.pausedAtMs!==undefined&&(!safe(s.pausedAtMs)||s.pausedAtMs<s.startedAtMs||s.pausedAtMs>now))throw new Error('TIMER_PAUSE_INVALID');
}
export function remainingTimeMs(s:TimerSnapshot,serverNowMs:number){
 guard(s,serverNowMs);
 const effective=s.pausedAtMs??serverNowMs;
 const elapsed=Math.max(0,effective-s.startedAtMs-s.accumulatedPauseMs);
 return Math.max(0,s.durationMs-elapsed);
}
export function pauseTimer(s:TimerSnapshot,serverNowMs:number):Readonly<TimerSnapshot>{
 guard(s,serverNowMs);
 if(s.pausedAtMs!==undefined)throw new Error('TIMER_ALREADY_PAUSED');
 if(remainingTimeMs(s,serverNowMs)===0)throw new Error('TIMER_ALREADY_FINISHED');
 return Object.freeze({...s,pausedAtMs:serverNowMs});
}
export function resumeTimer(s:TimerSnapshot,serverNowMs:number):Readonly<TimerSnapshot>{
 guard(s,serverNowMs);
 if(s.pausedAtMs===undefined)throw new Error('TIMER_NOT_PAUSED');
 return Object.freeze({startedAtMs:s.startedAtMs,durationMs:s.durationMs,accumulatedPauseMs:s.accumulatedPauseMs+serverNowMs-s.pausedAtMs});
}
// Persist state transitions with database version fence and audit; source the clock from trusted server/database time.
