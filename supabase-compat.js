import { supabase } from "./supabase-adapter.js";
const stamp=()=>new Date().toISOString(), id=()=>crypto.randomUUID();
const profile=async r=>{if(!r)return r;let photoURL=r.avatar_url||"";if(photoURL.startsWith("avatars/")){const{data,error}=await supabase.storage.from("vibesnap-media").createSignedUrl(photoURL,3600);if(!error&&data?.signedUrl)photoURL=data.signedUrl}return{id:r.user_id,uid:r.user_id,username:r.username,displayName:r.display_name||r.username,email:"",phone:"",photoURL,lastActiveAt:r.last_seen_at,isOnline:r.is_online===true&&!!r.last_seen_at&&Date.now()-Date.parse(r.last_seen_at)<120000,friendNicknames:r.friend_nicknames||{},encryptionPublicKey:r.encryption_public_key||null,createdAt:r.created_at}};
const request=r=>r&&({id:r.sender_id+"_"+r.receiver_id,fromUid:r.sender_id,toUid:r.receiver_id,status:r.status,createdAt:r.created_at,acceptedAt:r.updated_at,respondedAt:r.updated_at});
const friendship=r=>r&&({id:[r.user_one,r.user_two].sort().join("_"),members:[r.user_one,r.user_two],status:"accepted",createdAt:r.created_at});
const message=async r=>{
 let mediaUrl=r.media_url||"";
 if(r.storage_path){
  const {data,error}=await supabase.storage.from("vibesnap-media").createSignedUrl(r.storage_path,3600);
  if(!error&&data?.signedUrl)mediaUrl=data.signedUrl;
 }
 return {id:r.id,senderUid:r.sender_uid,receiverUid:r.receiver_uid,type:r.message_type,text:"",encryptedText:r.encrypted_text,iv:r.iv,cryptoVersion:r.crypto_version,mediaUrl,storagePath:r.storage_path,mediaContentType:r.media_content_type,mediaSize:r.media_size,createdAt:r.created_at,editedAt:r.edited_at||null,replyToId:r.reply_to_id||null};
};
const mapped=async(n,rows)=>n==="messages"?Promise.all(rows.map(message)):n==="users"?Promise.all(rows.map(profile)):rows.map(n==="friendRequests"?request:n==="friendships"?friendship:x=>x);
const toProfile=v=>{const x={};if("username"in v)x.username=v.username;if("displayName"in v)x.display_name=v.displayName;if("photoURL"in v)x.avatar_url=v.photoURL||null;if("lastActiveAt"in v)x.last_seen_at=v.lastActiveAt;if("isOnline"in v)x.is_online=!!v.isOnline;if("encryptionPublicKey"in v)x.encryption_public_key=v.encryptionPublicKey;return x};
class Snap{constructor(rows){this.docs=rows.map(x=>({id:x.id,exists:true,data:()=>x}));this.empty=!rows.length;this.size=rows.length}forEach(f){this.docs.forEach(f)}}
class Ref{
 constructor(name,chat=null,doc=null,filters=[],sort=null){Object.assign(this,{name,chat,docId:doc,filters,sort})}
 get id(){return this.docId}
 collection(n){if(this.name!=="chats"||n!=="messages")throw Error("Unsupported collection");return new Ref("messages",this.docId)}
 doc(id){return new Ref(this.name,this.chat,id||crypto.randomUUID())}
 where(f,o,v){return new Ref(this.name,this.chat,this.docId,[...this.filters,[f,o,v]],this.sort)}
 orderBy(f,d="asc"){return new Ref(this.name,this.chat,this.docId,this.filters,[f,d])}
 async rows(){
 let table={users:"profiles",friendRequests:"friend_requests",friendships:"friendships",messages:"messages",chats:"conversations"}[this.name];
 let q=supabase.from(table).select(this.name==="users"?"user_id,username,display_name,avatar_url,last_seen_at,is_online,encryption_public_key,created_at":"*");
 if(this.docId){if(this.name==="users")q=q.eq("user_id",this.docId);else if(this.name==="friendRequests"){let [a,b]=this.docId.split("_");q=q.eq("sender_id",a).eq("receiver_id",b)}else if(this.name==="friendships"){let [a,b]=this.docId.split("_");q=q.eq("user_one",a).eq("user_two",b)}else if(this.name==="chats")q=q.eq("id",this.docId);else q=q.eq("id",this.docId).eq("conversation_id",this.chat)}
 if(this.name==="messages")q=q.eq("conversation_id",this.chat);
 for(const [f,o,v] of this.filters){let col=this.name==="friendRequests"?(f==="toUid"?"receiver_id":"sender_id"):this.name==="messages"?(f==="senderUid"?"sender_uid":"receiver_uid"):f;if(this.name==="friendships"&&f==="members"&&o==="array-contains")q=q.or("user_one.eq."+v+",user_two.eq."+v);else if(o==="==")q=q.eq(col,v)}
 if(this.sort)q=q.order(this.sort[0]==="createdAt"?"created_at":this.sort[0],{ascending:this.sort[1]!=="desc"});
 const {data,error}=await q;if(error)throw error;
 let rows=data||[];
 if(this.name==="users"&&rows.length){
  const {data:{user}}=await supabase.auth.getUser();
  if(user&&(this.docId===user.id||rows.some(row=>row.user_id===user.id))){
   const privateResult=await supabase.from("profile_private").select("friend_nicknames").eq("user_id",user.id).maybeSingle();
   if(privateResult.error)throw privateResult.error;
   if(privateResult.data){
    rows=rows.map(row=>row.user_id===user.id?{...row,friend_nicknames:privateResult.data.friend_nicknames||{}}:row);
   }
  }
 }
 return mapped(this.name,rows);
 }
 async get(){const a=await this.rows();return this.docId?{id:this.docId,exists:!!a[0],data:()=>a[0]}:new Snap(a)}
 onSnapshot(cb,err){let active=true,pollTimer=null;const refresh=()=>this.rows().then(a=>{if(active)cb(new Snap(a))}).catch(e=>{if(active&&err)err(e)});refresh();const table={users:"profiles",friendRequests:"friend_requests",friendships:"friendships",messages:"messages"}[this.name];const ch=supabase.channel("vs-"+id()).on("postgres_changes",{event:"*",schema:"public",table},refresh).subscribe();if(this.name==="users"){pollTimer=setInterval(refresh,10000)}return()=>{active=false;if(pollTimer)clearInterval(pollTimer);supabase.removeChannel(ch)}}
 async set(v){let e;
 if(this.name==="users"){
  let x=toProfile(v);x.user_id=this.docId;
  if(!x.username){const {data}=await supabase.auth.getUser();x.username=data.user?.user_metadata?.username||"user_"+this.docId.slice(0,8)}
  if(Object.keys(x).some(k=>k!=="user_id"))({error:e}=await supabase.from("profiles").upsert(x,{onConflict:"user_id"}));
  if(!e&&"friendNicknames"in v)({error:e}=await supabase.from("profile_private").upsert({user_id:this.docId,friend_nicknames:v.friendNicknames||{},updated_at:stamp()},{onConflict:"user_id"}));
 }
 else if(this.name==="friendRequests"){let [a,b]=this.docId.split("_");({error:e}=await supabase.from("friend_requests").insert({sender_id:v.fromUid||a,receiver_id:v.toUid||b,status:v.status||"pending"}))}
 else if(this.name==="friendships"){let [a,b]=(v.members||this.docId.split("_")).sort();({error:e}=await supabase.from("friendships").insert({user_one:a,user_two:b}))}
 else if(this.name==="chats"){let m=v.members||[];let{data:existing,error:readError}=await supabase.from("conversations").select("id").eq("id",this.docId).maybeSingle();if(readError)e=readError;else if(!existing)({error:e}=await supabase.from("conversations").insert({id:this.docId,created_by:m[0],updated_at:stamp()}));if(!e)for(const u of m){const{data:member,error:memberError}=await supabase.from("conversation_members").select("user_id").eq("conversation_id",this.docId).eq("user_id",u).maybeSingle();if(memberError){e=memberError;break}if(!member){({error:e}=await supabase.from("conversation_members").insert({conversation_id:this.docId,user_id:u}));if(e)break}}}
 else if(this.name==="messages"){({error:e}=await supabase.from("messages").insert({id:this.docId,conversation_id:this.chat,sender_uid:v.senderUid,receiver_uid:v.receiverUid||null,message_type:v.type||"text",encrypted_text:v.encryptedText||null,iv:v.iv||null,crypto_version:v.cryptoVersion||null,media_url:v.storagePath?null:(v.mediaUrl||null),storage_path:v.storagePath||null,media_content_type:v.mediaContentType||null,media_size:v.mediaSize||null,reply_to_id:v.replyToId||null,edited_at:v.editedAt||null}))}
 if(e)throw e}
 async update(v){let q,e;if(this.name==="users"){
  const x=toProfile(v);
  if(Object.keys(x).length)({error:e}=await supabase.from("profiles").update(x).eq("user_id",this.docId));
  if(!e&&"friendNicknames"in v)({error:e}=await supabase.from("profile_private").upsert({user_id:this.docId,friend_nicknames:v.friendNicknames||{},updated_at:stamp()},{onConflict:"user_id"}));
 }else if(this.name==="friendRequests"){let[a,b]=this.docId.split("_");({error:e}=await supabase.from("friend_requests").update({status:v.status,updated_at:stamp()}).eq("sender_id",a).eq("receiver_id",b))}else if(this.name==="messages"){const x={};if("encryptedText"in v)x.encrypted_text=v.encryptedText;if("iv"in v)x.iv=v.iv;if("cryptoVersion"in v)x.crypto_version=v.cryptoVersion;if("editedAt"in v)x.edited_at=v.editedAt;if("replyToId"in v)x.reply_to_id=v.replyToId;({error:e}=await supabase.from("messages").update(x).eq("id",this.docId).eq("conversation_id",this.chat))}else throw Error("Unsupported update");if(e)throw e}
 async delete(){if(this.name!=="messages")throw Error("Unsupported delete");const{error}=await supabase.from("messages").delete().eq("id",this.docId).eq("conversation_id",this.chat);if(error)throw error}
 async add(v){let d=this.doc(id());await d.set(v);return d}
}
const db={collection:n=>new Ref(n),batch(){let sets=[],updates=[];return{set:(r,v)=>sets.push(()=>r.set(v)),update:(r,v)=>updates.push(()=>r.update(v)),async commit(){for(const j of updates)await j();for(const j of sets)await j()}}}};
const wrap=u=>u&&({uid:u.id,email:u.email||"",displayName:u.user_metadata?.username||"",async updateProfile(v){if(v.displayName){const{error}=await supabase.from("profiles").update({display_name:v.displayName}).eq("user_id",u.id);if(error)throw error}}});
const auth={async signInWithEmailAndPassword(email,password){let{data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw Object.assign(error,{code:"auth/invalid-credential"});return{user:wrap(data.user)}},async createUserWithEmailAndPassword(email,password){let{data,error}=await supabase.auth.signUp({email,password,options:{data:{username:email.split("@")[0]}}});if(error)throw Object.assign(error,{code:error.code==="user_already_exists"?"auth/email-already-in-use":error.code});if(!data.user)throw Error("Account creation failed. Check Supabase email confirmation settings.");return{user:wrap(data.user)}},onAuthStateChanged(cb){let alive=true;let{data}=supabase.auth.onAuthStateChange((e,s)=>alive&&cb(wrap(s?.user)));return()=>{alive=false;data.subscription.unsubscribe()}},async signOut(){let{error}=await supabase.auth.signOut();if(error)throw error}};
const storage={ref(){return{child(path){return{async put(blob,o){let{error}=await supabase.storage.from("vibesnap-media").upload(path,blob,{contentType:o.contentType});if(error)throw error},async getDownloadURL(){let{data,error}=await supabase.storage.from("vibesnap-media").createSignedUrl(path,3600);if(error)throw error;return data.signedUrl}}}}}};
export{auth,db,storage};
