/** LC-31 deterministic balanced ledger preflight. Not a processor settlement receipt. */
export interface LedgerLine{accountId:string;side:'debit'|'credit';minorUnits:number;currency:string}
export interface LedgerJournal{idempotencyKey:string;organizationId:string;lines:readonly LedgerLine[]}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const CURRENCY=/^[A-Z]{3}$/;
export function validateLedgerJournal(j:LedgerJournal){
 if(!j||!UUID.test(j.organizationId)||!UUID.test(j.idempotencyKey)||!Array.isArray(j.lines)||j.lines.length<2||j.lines.length>50)throw new Error('LEDGER_JOURNAL_INVALID');
 let debit=0,credit=0;let currency:string|undefined;
 const accountSides=new Set<string>();
 for(const line of j.lines){
  if(!line||!UUID.test(line.accountId)||!['debit','credit'].includes(line.side)||!Number.isSafeInteger(line.minorUnits)||line.minorUnits<1||!CURRENCY.test(line.currency))throw new Error('LEDGER_LINE_INVALID');
  if(currency&&currency!==line.currency)throw new Error('LEDGER_CURRENCY_MISMATCH');currency=line.currency;
  const id=JSON.stringify([line.accountId,line.side]);
  if(accountSides.has(id))throw new Error('LEDGER_DUPLICATE_LINE');accountSides.add(id);
  if(line.side==='debit')debit+=line.minorUnits;else credit+=line.minorUnits;
  if(!Number.isSafeInteger(debit)||!Number.isSafeInteger(credit))throw new Error('LEDGER_OVERFLOW');
 }
 if(debit!==credit)throw new Error('LEDGER_UNBALANCED');
 return Object.freeze({idempotencyKey:j.idempotencyKey,organizationId:j.organizationId,currency,minorUnits:debit,lines:Object.freeze(j.lines.map(x=>Object.freeze({...x})))});
}
// Real ledger commits require DB transaction, account ownership/permissions, unique idempotency key, append-only records and gateway evidence.
