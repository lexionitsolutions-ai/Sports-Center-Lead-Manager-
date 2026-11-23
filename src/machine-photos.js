function readDataUrl(blob) {
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Unable to read this photo.'));reader.readAsDataURL(blob);});
}
export async function photoDataUrl(file) {
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPG, PNG or WebP photo.');
 if(file.size>15*1024*1024)throw Error('Choose a photo smaller than 15 MB.');
 const url=await readDataUrl(file);
 const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('This photo could not be opened.'));img.src=url;});
 const scale=Math.min(1,1000/Math.max(image.width,image.height));
 const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
 const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
 return canvas.toDataURL('image/jpeg',0.82);
}
export async function snapshotPhoto(url) {
 if(!url)return '';
 if(url.startsWith('data:image/jpeg;base64,'))return url;
 try{const response=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Photo unavailable');return await photoDataUrl(await response.blob());}
 catch{throw Error('This photo could not be loaded for the quotation. Upload the photo from your device in the Machinery database.');}
}
