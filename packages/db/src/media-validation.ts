/** LC-11: fail-closed tenant media metadata policy, before storage or public distribution. */
export type MediaKind = 'image' | 'video' | 'audio';
export interface ProposedMedia {
  tenantId: string; ownerId: string; kind: MediaKind;
  mime: string; bytes: number; sha256: string; filename: string;
}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{12}$/i;
const HASH=/^[a-f0-9]{64}$/i;
const TYPES: Record<MediaKind, readonly string[]> = {
  image:['image/png','image/jpeg','image/webp'],
  video:['video/mp4','video/webm'],
  audio:['audio/mpeg','audio/ogg','audio/wav']
};
const LIMITS:Record<MediaKind,number>={image:20*1024*1024,video:500*1024*1024,audio:100*1024*1024};
export function validateMediaSubmission(input:ProposedMedia):Readonly<ProposedMedia>{
 if(!input||!UUID.test(input.tenantId)||!UUID.test(input.ownerId))throw new Error('MEDIA_ACTOR_INVALID');
 if(!Object.hasOwn(TYPES,input.kind)||!TYPES[input.kind]?.includes(input.mime))throw new Error('MEDIA_TYPE_FORBIDDEN');
 if(!Number.isSafeInteger(input.bytes)||input.bytes<1||input.bytes>LIMITS[input.kind])throw new Error('MEDIA_SIZE_FORBIDDEN');
 if(!HASH.test(input.sha256))throw new Error('MEDIA_DIGEST_REQUIRED');
 if(!input.filename||input.filename.length>160||!(/^[a-zA-Z0-9][a-zA-Z0-9._ -]*$/).test(input.filename)||input.filename.includes('..'))throw new Error('MEDIA_FILENAME_INVALID');
 return Object.freeze({...input});
}
/** Metadata validation is not content scanning, tenancy authorization or publish approval. */
