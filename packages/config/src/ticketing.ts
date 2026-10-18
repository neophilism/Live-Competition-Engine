/** LC-33 ticket offer constraints. Creating a quote does not issue access or collect funds. */
export type TicketKind='admission'|'pay_per_view'|'entrant_fee';
export interface TicketOffer{organizationId:string;eventId:string;kind:TicketKind;currency:string;minorUnits:number;capacity:number;startsAtMs:number;endsAtMs:number}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function validateTicketOffer(t:TicketOffer){
 if(!t||!UUID.test(t.organizationId)||!UUID.test(t.eventId))throw new Error('TICKET_SCOPE_INVALID');
 if(!['admission','pay_per_view','entrant_fee'].includes(t.kind)||!(/^[A-Z]{3}$/).test(t.currency))throw new Error('TICKET_KIND_INVALID');
 if(!Number.isSafeInteger(t.minorUnits)||t.minorUnits<0||t.minorUnits>1000000000)throw new Error('TICKET_AMOUNT_INVALID');
 if(!Number.isSafeInteger(t.capacity)||t.capacity<1||t.capacity>10000000)throw new Error('TICKET_CAPACITY_INVALID');
 if(!Number.isSafeInteger(t.startsAtMs)||!Number.isSafeInteger(t.endsAtMs)||t.startsAtMs>=t.endsAtMs)throw new Error('TICKET_WINDOW_INVALID');
 return Object.freeze({...t});
}
export function canReserveTicket(t:TicketOffer,serverNowMs:number,reserved:number){
 validateTicketOffer(t);
 if(!Number.isSafeInteger(serverNowMs)||!Number.isSafeInteger(reserved)||reserved<0)throw new Error('TICKET_STATE_INVALID');
 return serverNowMs>=t.startsAtMs&&serverNowMs<t.endsAtMs&&reserved<t.capacity;
}
// Real inventory reservation requires serializable/locked DB transaction, provider receipt and idempotent issuance.
