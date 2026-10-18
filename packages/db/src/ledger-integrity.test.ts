import {describe,it,expect} from 'vitest';
import {validateLedgerJournal} from './ledger-integrity';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const journal={idempotencyKey:a,organizationId:a,lines:[{accountId:a,side:'debit' as const,minorUnits:500,currency:'USD'},{accountId:b,side:'credit' as const,minorUnits:500,currency:'USD'}]};
describe('LC-31 balanced journal guard',()=>{
 it('requires one balanced currency',()=>expect(validateLedgerJournal(journal).minorUnits).toBe(500));
 it('denies imbalanced and mixed currencies',()=>{
  expect(()=>validateLedgerJournal({...journal,lines:[journal.lines[0],{...journal.lines[1],minorUnits:499}]})).toThrow('LEDGER_UNBALANCED');
  expect(()=>validateLedgerJournal({...journal,lines:[journal.lines[0],{...journal.lines[1],currency:'EUR'}]})).toThrow('LEDGER_CURRENCY_MISMATCH');
 });
 it('denies fractional/cross-invalid amounts',()=>{
  expect(()=>validateLedgerJournal({...journal,lines:[{...journal.lines[0],minorUnits:0},journal.lines[1]]})).toThrow('LEDGER_LINE_INVALID');
  expect(()=>validateLedgerJournal({...journal,idempotencyKey:'not-a-uuid'})).toThrow('LEDGER_JOURNAL_INVALID');
 });
});
