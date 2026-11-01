"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { MediaClient, MediaItem } from "../lib/media-client";

const statusLabel:Record<string,string>={quarantined:"Waiting for checks",processing:"Being checked",ready:"Ready",rejected:"Could not be approved"};
export function MediaLibrary({client}:{client:MediaClient}){
 const [items,setItems]=useState<MediaItem[]>([]),[file,setFile]=useState<File|null>(null),[consent,setConsent]=useState(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[preview,setPreview]=useState<{url:string;item:MediaItem}|null>(null);
 const epoch=useRef(0);
 const fileInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{
  const current=++epoch.current;setItems([]);setFile(null);setConsent(false);setPreview(null);setMessage("");setBusy(true);
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
   await client.upload(file);
   if(epoch.current===current){setFile(null);setConsent(false);if(fileInput.current)fileInput.current.value="";
    setMessage("Uploaded. Your file will be available after its checks.");}
  });
 }
 return <section aria-labelledby="media-title">
  <h1 id="media-title">Your media library</h1>
  <p>Your files stay private. Only approved versions can be played here.</p>
  <form onSubmit={upload}>
   <label htmlFor="media-file">Choose an image, audio recording or video (up to 8 MiB)</label>
   <input ref={fileInput} id="media-file" type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,audio/mpeg,audio/ogg,audio/wav"
    disabled={busy} onChange={event=>{setFile(event.target.files?.[0]??null);setConsent(false);}}/>
   <label><input type="checkbox" checked={consent} disabled={busy||!file} onChange={event=>setConsent(event.target.checked)}/>
    I own this file or have permission to store and process it, and I have the consent of people whose participation requires it.</label>
   <button type="submit" disabled={busy||!file||!consent}>Upload privately</button>
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
   <button disabled={busy} onClick={()=>void action(async()=>{
    const current=epoch.current;await client.revoke(item.id);if(epoch.current===current&&preview?.item.id===item.id)setPreview(null);
   })}>Withdraw {item.filename}</button>
  </li>)}</ul>
  {preview?<div>
   <h2>{preview.item.filename}</h2>
   {preview.item.kind==="image"?<img src={preview.url} alt={preview.item.filename} style={{maxWidth:"100%",maxHeight:"60vh"}}/>:
    preview.item.kind==="audio"?<audio src={preview.url} controls style={{maxWidth:"100%"}}/>:<video src={preview.url} controls style={{maxWidth:"100%",maxHeight:"60vh"}}/>}
   <button onClick={()=>setPreview(null)}>Close preview</button>
  </div>:null}
  <p>Withdrawing a file removes its stored versions and stops future playback. Copies already downloaded cannot be recalled.</p>
 </section>;
}

