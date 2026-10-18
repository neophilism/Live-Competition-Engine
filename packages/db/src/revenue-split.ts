/** LC-32 exact integer revenue allocation. This is computation, never an approved transfer. */
export interface RevenueShare{recipientId:string;basisPoints:number}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function allocateRevenue(amountMinorUnits:number,shares:readonly RevenueShare[]){
 if(!Number.isSafeInteger(amountMinorUnits)||amountMinorUnits<0)throw new Error('SPLIT_AMOUNT_INVALID');
 if(!Array.isArray(shares)||shares.length<1||shares.length>50)throw new Error('SPLIT_RECIPIENTS_INVALID');
 const used=new Set<string>();let sum=0;
 for(const s of shares){
  if(!s||!UUID.test(s.recipientId)||used.has(s.recipientId)||!Number.isSafeInteger(s.basisPoints)||s.basisPoints<0||s.basisPoints>10000)throw new Error('SPLIT_SHARE_INVALID');
  used.add(s.recipientId);sum+=s.basisPoints;
 }
 if(sum!==10000)throw new Error('SPLIT_TOTAL_INVALID');
 const amount=BigInt(amountMinorUnits),den=10000n;
 const rows=shares.map(s=>{const q=amount*BigInt(s.basisPoints);return {...s,minorUnits:Number(q/den),remainder:q%den};});
 let remaining=amountMinorUnits-rows.reduce((n,s)=>n+s.minorUnits,0);
 const priority=[...rows].sort((a,b)=>a.remainder===b.remainder?(a.recipientId<b.recipientId?-1:1):(a.remainder>b.remainder?-1:1));
 for(let i=0;i<remaining;i++)priority[i]!.minorUnits++;
 return Object.freeze(rows.map(s=>Object.freeze({recipientId:s.recipientId,basisPoints:s.basisPoints,minorUnits:s.minorUnits})));
}
// Settlement must authenticate recipient accounts, lock published split rules, record idempotent ledger and processor payouts.
