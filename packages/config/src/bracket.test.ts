import {describe,it,expect} from 'vitest';
import {createOpeningBracket,validateBracketWinner} from './bracket';
describe('LC-16 bracket invariants',()=>{
 it('seeds deterministic matches',()=>expect(createOpeningBracket(['a','b','c','d'])).toEqual([
  {round:1,slot:1,left:'a',right:'b'},{round:1,slot:2,left:'c',right:'d'}
 ]));
 it('rejects non-power-of-two and duplicate seeds',()=>{
  expect(()=>createOpeningBracket(['a','b','c'])).toThrow('BRACKET_SIZE_INVALID');
  expect(()=>createOpeningBracket(['a','a'])).toThrow('BRACKET_SEED_INVALID');
 });
 it('rejects an outsider winner',()=>{
  const pair=createOpeningBracket(['a','b'])[0]!;
  expect(validateBracketWinner(pair,'b')).toBe('b');
  expect(()=>validateBracketWinner(pair,'c')).toThrow('BRACKET_WINNER_INVALID');
 });
});
