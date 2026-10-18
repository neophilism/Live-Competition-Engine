import {describe,it,expect} from 'vitest';
import {canReserveTicket,validateTicketOffer} from './ticketing';
const id='11111111-1111-4111-8111-111111111111';
const ticket={organizationId:id,eventId:id,kind:'admission' as const,currency:'USD',minorUnits:1250,capacity:2,startsAtMs:100,endsAtMs:200};
describe('LC-33 ticket offer guard',()=>{
 it('allows only capacity-bound window',()=>{
  expect(canReserveTicket(ticket,120,1)).toBe(true);
  expect(canReserveTicket(ticket,120,2)).toBe(false);
  expect(canReserveTicket(ticket,200,0)).toBe(false);
 });
 it('rejects bad amount, kind and time window',()=>{
  expect(()=>validateTicketOffer({...ticket,minorUnits:1.5})).toThrow('TICKET_AMOUNT_INVALID');
  expect(()=>validateTicketOffer({...ticket,kind:'unknown' as never})).toThrow('TICKET_KIND_INVALID');
  expect(()=>validateTicketOffer({...ticket,endsAtMs:100})).toThrow('TICKET_WINDOW_INVALID');
 });
});
