"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { MediaClient, MediaItem, MediaVersion } from "../lib/media-client";
import styles from "./media-library.module.css";

const statusLabel:Record<string,string>={quarantined:"Waiting for checks",processing:"Being checked",ready:"Ready",rejected:"Could not be approved"};
export function MediaLibrary({client}:{client:MediaClient}){
 const [items,setItems]=useState<MediaItem[]>([]),[file,setFile]=useState<File|null>(null),[consent,setConsent]=useState(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[preview,setPreview]=useState<{url:string;item:MediaItem}|null>(null);
 const [replacing,setReplacing]=useState<MediaItem|null>(null);
 const [history,setHistory]=useState<{id:string;items:MediaVersion[];next:number|null}|null>(null);
 const epoch=useRef(0);
 const fileInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{
  const current=++epoch.current;setItems([]);setFile(null);setConsent(false);setPreview(null);setMessage("");setBusy(true);
  setReplacing(null);
  setHistory(null);
  if(fileInput.current)fileInput.current.value="";
  client.list().then(rows=>{if(epoch.current===current)setItems(rows);})
   .catch(cause=>{if(epoch.current===current)setMessage(cause instanceof Error?cause.message:"Unable to load media.");})
   .finally(()=>{if(epoch.current===current)setBusy(false);});
  return()=>{epoch.current++;};
 },[client]);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview.url);},[preview]);
 async function action(run:()=>Promise<void>){
  const current=epoch.current;setBusy(true);setMessage("");
  try{await run();if(epoch.current===current){const rows=await client.list();if(epoch.current===current)setItems(rows);}}
  catch(cause){if(epoch.current===current)setMessage(cause instanceof Error?cause.message:"Unable to update media.");}
  finally{if(epoch.current===current)setBusy(false);}
 }
 async function upload(event:FormEvent){
  event.preventDefault();if(!file||!consent||busy)return;
  const current=epoch.current;
  await action(async()=>{
   await client.upload(file,replacing??undefined);
   if(epoch.current===current){setFile(null);setConsent(false);setReplacing(null);
    if(replacing&&preview?.item.id===replacing.id)setPreview(null);
    if(replacing&&history?.id===replacing.id)setHistory(null);
    if(fileInput.current)fileInput.current.value="";
    setMessage("Uploaded. Your file will be available after its checks.");}
  });
 }
 return <section className={styles.library} aria-labelledby="media-title" aria-busy={busy}>
  <h1 id="media-title">Your media library</h1>
  <p>Your files stay private. Only approved versions can be played here.</p>
  <form onSubmit={upload}>
   {replacing?<p>Replacing {replacing.filename}, version {replacing.revision}. A replacement needs fresh consent and checks.</p>:null}
   <label htmlFor="media-file">Choose an image, audio recording or video (up to 8 MiB)</label>
   <input ref={fileInput} id="media-file" type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,audio/mpeg,audio/ogg,audio/wav"
    disabled={busy} onChange={event=>{setFile(event.target.files?.[0]??null);setConsent(false);}}/>
   <label><input type="checkbox" checked={consent} disabled={busy||!file} onChange={event=>setConsent(event.target.checked)}/>
    I own this file or have permission to store and process it, and I have the consent of people whose participation requires it.</label>
   <button type="submit" disabled={busy||!file||!consent}>{replacing?"Upload new version":"Upload privately"}</button>
   {replacing?<button type="button" disabled={busy} onClick={()=>{setReplacing(null);setFile(null);setConsent(false);if(fileInput.current)fileInput.current.value="";}}>Cancel replacement</button>:null}
  </form>
  <p role="status" aria-live="polite">{message|| (busy?"Updating your library…":"")}</p>
  <button disabled={busy} onClick={()=>void action(async()=>{})}>Refresh library</button>
  {!items.length&&!busy?<p>No files yet.</p>:null}
  <ul>{items.map(item=><li key={item.id}>
   <span>{item.filename}</span> <span>Version {item.revision} · {statusLabel[item.status]??"Unavailable"}</span>
   <button disabled={busy||item.status!=="ready"} onClick={()=>void action(async()=>{
    const current=epoch.current;const blob=await client.playback(item.id);
    if(epoch.current===current)setPreview({url:URL.createObjectURL(blob),item});
   })}>Open {item.filename}</button>
   <button disabled={busy} onClick={()=>{setReplacing(item);setFile(null);setConsent(false);if(fileInput.current){fileInput.current.value="";fileInput.current.focus();}}}>Replace {item.filename}</button>
   <button disabled={busy} aria-expanded={history?.id===item.id} onClick={()=>void action(async()=>{
    const current=epoch.current;const result=await client.versions(item.id);
    if(epoch.current===current)setHistory({id:item.id,...result});
   })}>Versions of {item.filename}</button>
   <button disabled={busy} onClick={()=>void action(async()=>{
    const current=epoch.current;await client.revoke(item.id);if(epoch.current===current&&preview?.item.id===item.id)setPreview(null);
    if(epoch.current===current&&history?.id===item.id)setHistory(null);
   })}>Withdraw {item.filename}</button>
  </li>)}</ul>
  {preview?<div>
   <h2>{preview.item.filename}</h2>
   {preview.item.kind==="image"?<img src={preview.url} alt={preview.item.filename} style={{maxWidth:"100%",maxHeight:"60vh"}}/>:
    preview.item.kind==="audio"?<audio src={preview.url} controls style={{maxWidth:"100%"}}/>:<video src={preview.url} controls style={{maxWidth:"100%",maxHeight:"60vh"}}/>}
   <button onClick={()=>setPreview(null)}>Close preview</button>
  </div>:null}
  {history?<section aria-label="Version history">
   <h2>Version history</h2>
   <ul>{history.items.map(version=><li key={version.revision}>Version {version.revision}: {version.filename} · {statusLabel[version.status]??"No longer available"} · Consent {version.rightsVersion} accepted {new Date(version.acceptedAt).toLocaleString()}</li>)}</ul>
   {history.next!==null?<button disabled={busy} onClick={()=>void action(async()=>{
    const current=epoch.current;const result=await client.versions(history.id,history.next!);
    if(epoch.current===current)setHistory({...history,items:[...history.items,...result.items],next:result.next});
   })}>Older versions</button>:null}
   <button onClick={()=>setHistory(null)}>Close version history</button>
  </section>:null}
  <p>Withdrawing a file removes its stored versions and stops future playback. Copies already downloaded cannot be recalled.</p>
 </section>;
}

