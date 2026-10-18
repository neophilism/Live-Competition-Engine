/** Configuration boundaries for organization-scoped competition behavior. */
export interface CompetitionConfig{allowLateEntry:boolean;maxEntries:number;maxRounds:number;votingMethod:'judges'|'audience'|'hybrid';audienceWeight?:number}
export function validateCompetitionConfig(input:CompetitionConfig):Readonly<CompetitionConfig>{
 if(!input||typeof input.allowLateEntry!=='boolean')throw new Error('CONFIG_INVALID');
 if(!Number.isSafeInteger(input.maxEntries)||input.maxEntries<1||input.maxEntries>100000)throw new Error('CONFIG_ENTRIES_INVALID');
 if(!Number.isSafeInteger(input.maxRounds)||input.maxRounds<1||input.maxRounds>128)throw new Error('CONFIG_ROUNDS_INVALID');
 if(!['judges','audience','hybrid'].includes(input.votingMethod))throw new Error('CONFIG_VOTING_INVALID');
 if(input.votingMethod==='hybrid'){
  if(typeof input.audienceWeight!=='number'||!Number.isFinite(input.audienceWeight)||input.audienceWeight<=0||input.audienceWeight>=1)throw new Error('CONFIG_WEIGHT_INVALID');
 } else if(input.audienceWeight!==undefined)throw new Error('CONFIG_WEIGHT_NOT_APPLICABLE');
 return Object.freeze({...input});
}
