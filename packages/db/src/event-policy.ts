export type EventStatus='draft'|'published'|'live'|'paused'|'completed'|'cancelled';
export interface EventDraft{organizationId:string;title:string;description?:string;startsAt?:string;endsAt?:string}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function validateEventDraft(d:EventDraft){
 if(!d||!UUID.test(d.organizationId))throw new Error('EVENT_ORGANIZATION_REQUIRED');
 if(typeof d.title!=='string'||!d.title.trim()||d.title.length>180||/[<>\x00-\x1f]/.test(d.title))throw new Error('EVENT_TITLE_INVALID');
 if(d.description!==undefined&&(typeof d.description!=='string'||d.description.length>5000))throw new Error('EVENT_DESCRIPTION_INVALID');
 if(d.startsAt!==undefined||d.endsAt!==undefined){
  const start=Date.parse(d.startsAt??''),end=Date.parse(d.endsAt??'');
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end)throw new Error('EVENT_SCHEDULE_INVALID');
 }
 return Object.freeze({...d,title:d.title.trim()});
}
export function mayTransition(from:EventStatus,to:EventStatus){
 const edges:Record<EventStatus,readonly EventStatus[]>={
  draft:['published','cancelled'],published:['live','cancelled'],live:['paused','completed','cancelled'],
  paused:['live','cancelled'],completed:[],cancelled:[]
 };
 return edges[from]?.includes(to)??false;
}
// Must pair transition with authenticated organization RBAC and persisted transaction/audit log.
