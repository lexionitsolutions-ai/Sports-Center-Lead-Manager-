const DB='sports-center-workspace', STORE='workspace';
function connect() {
 return new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Browser database could not be opened.'));});
}
export async function readDemo() {
 const db=await connect();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly');const request=tx.objectStore(STORE).get('data');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}finally{db.close();}
}
export async function writeDemo(data) {
 const db=await connect();try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(data,'data');tx.oncomplete=resolve;tx.onerror=()=>reject(Error('Unable to save the browser database. Check available device storage.'));tx.onabort=()=>reject(Error('Unable to save the browser database. Check available device storage.'));});}finally{db.close();}
}
