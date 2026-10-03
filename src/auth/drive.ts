const DRIVE_API = 'https://www.googleapis.com/drive/v3';

type DriveState = { accessToken: string; folderId: string; backupFileId?: string };
let state: DriveState | null = null;

function authHeaders(token: string) { return { Authorization: `Bearer ${token}` }; }
function dbName() { const uid = localStorage.getItem('rf-active-user'); return uid ? `recallforge-v1-${uid}` : 'recallforge-v1'; }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName(), 3);
    request.onupgradeneeded = () => { const db=request.result; for (const name of ['images','regions','cards','annotations','folders']) if(!db.objectStoreNames.contains(name)) db.createObjectStore(name,{keyPath:'id'}); };
    request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error);
  });
}
async function readAll(store:string):Promise<any[]> { const db=await openDb(); return new Promise((resolve,reject)=>{const r=db.transaction(store,'readonly').objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}); }
function blobToDataUrl(blob:Blob):Promise<string>{return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(r.error);r.readAsDataURL(blob)})}
async function serialise(value:any):Promise<any>{
  if(value instanceof Blob)return{__blob:true,type:value.type,data:await blobToDataUrl(value)};
  if(Array.isArray(value))return Promise.all(value.map(serialise));
  if(value&&typeof value==='object'){const out:any={};for(const[k,v]of Object.entries(value))out[k]=await serialise(v);return out;}
  return value;
}
async function makeBackup(){const data:any={};for(const store of ['images','regions','cards','annotations','folders'])data[store]=await Promise.all((await readAll(store)).map(serialise));return JSON.stringify({format:'recallforge-backup',version:1,exportedAt:new Date().toISOString(),data});}
async function ensureFolder(token:string){
  const cached=localStorage.getItem('rf-drive-folder');if(cached)return cached;
  const q=encodeURIComponent("name='RecallForge' and mimeType='application/vnd.google-apps.folder' and trashed=false");
  const existing=await fetch(`${DRIVE_API}/files?q=${q}&spaces=drive&fields=files(id,name)&pageSize=10`,{headers:authHeaders(token)});
  if(!existing.ok)throw new Error('Google Drive could not be accessed.');
  const result=await existing.json();const found=result.files?.[0]?.id;if(found){localStorage.setItem('rf-drive-folder',found);return found;}
  const response=await fetch(`${DRIVE_API}/files?fields=id,name`,{method:'POST',headers:{...authHeaders(token),'Content-Type':'application/json'},body:JSON.stringify({name:'RecallForge',mimeType:'application/vnd.google-apps.folder'})});
  if(!response.ok)throw new Error('Could not create the RecallForge folder in Google Drive.');
  const folder=await response.json();localStorage.setItem('rf-drive-folder',folder.id);return folder.id;
}
async function findBackup(token:string,folderId:string){const q=encodeURIComponent(`'${folderId}' in parents and name='recallforge-data.json' and trashed=false`);const response=await fetch(`${DRIVE_API}/files?q=${q}&spaces=drive&fields=files(id,name)&pageSize=10`,{headers:authHeaders(token)});if(!response.ok)return undefined;const result=await response.json();return result.files?.[0]?.id;}
async function uploadOrUpdate(token:string,folderId:string,backupId:string|undefined,content:string){
  const metadata={name:'recallforge-data.json',mimeType:'application/json',...(backupId?{}:{parents:[folderId]})};
  const boundary='recallforge_boundary_'+Math.random().toString(36).slice(2);
  const body=[`--${boundary}`,'Content-Type: application/json; charset=UTF-8','',JSON.stringify(metadata),`--${boundary}`,'Content-Type: application/json','',content,`--${boundary}--`,''].join('\r\n');
  const url=backupId?`${DRIVE_API}/files/${backupId}?uploadType=multipart&fields=id,name,modifiedTime`:`${DRIVE_API}/files?uploadType=multipart&fields=id,name,modifiedTime`;
  const response=await fetch(url,{method:backupId?'PATCH':'POST',headers:{...authHeaders(token),'Content-Type':`multipart/related; boundary=${boundary}`},body});
  if(!response.ok){let detail='';try{detail=await response.text()}catch{} throw new Error(`Google Drive rejected the RecallForge backup (${response.status}). ${detail||'Check Google Drive API and authorization.'}`);}
  return (await response.json()).id as string;
}
async function localHasData(){
  for(const store of ['images','regions','cards','annotations','folders']) if((await readAll(store)).length) return true;
  return false;
}
function dataUrlToBlob(data:string,type:string){const [meta,raw]=data.split(',');const bytes=atob(raw);const arr=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)arr[i]=bytes.charCodeAt(i);return new Blob([arr],{type:type||meta.match(/data:([^;]+)/)?.[1]||'application/octet-stream'});}
async function deserialise(value:any):Promise<any>{
  if(value&&value.__blob)return dataUrlToBlob(value.data,value.type);
  if(Array.isArray(value))return Promise.all(value.map(deserialise));
  if(value&&typeof value==='object'){const out:any={};for(const[k,v]of Object.entries(value))out[k]=await deserialise(v);return out;}
  return value;
}
async function writeBackup(content:string){
  const parsed=JSON.parse(content);if(parsed?.format!=='recallforge-backup'||!parsed.data)throw new Error('The RecallForge Drive backup is invalid.');
  const db=await openDb();
  for(const store of ['images','regions','cards','annotations','folders']){
    const tx=db.transaction(store,'readwrite');tx.objectStore(store).clear();await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});
    const tx2=db.transaction(store,'readwrite');for(const item of parsed.data[store]||[])tx2.objectStore(store).put(await deserialise(item));await new Promise<void>((resolve,reject)=>{tx2.oncomplete=()=>resolve();tx2.onerror=()=>reject(tx2.error)});
  }
  db.close();
}
export async function connectDrive(accessToken:string){const folderId=await ensureFolder(accessToken);const backupFileId=await findBackup(accessToken,folderId);state={accessToken,folderId,backupFileId};localStorage.setItem('rf-drive-connected','1');return{folderId,backupFileId};}
export async function restoreFromDriveIfEmpty(){if(!state?.backupFileId||await localHasData())return false;const response=await fetch(`${DRIVE_API}/files/${state.backupFileId}?alt=media`,{headers:authHeaders(state.accessToken)});if(!response.ok)return false;await writeBackup(await response.text());return true;}
export function disconnectDrive(){state=null;localStorage.removeItem('rf-drive-connected');localStorage.removeItem('rf-drive-folder');}
export function isDriveConnected(){return!!state;}
export async function syncToDrive(){if(!state)return;const content=await makeBackup();state.backupFileId=await uploadOrUpdate(state.accessToken,state.folderId,state.backupFileId,content);}
