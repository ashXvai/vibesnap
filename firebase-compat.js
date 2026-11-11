import { supabase } from "./supabase-adapter.js";
const stamp=()=>new Date().toISOString(), id=()=>crypto.randomUUID();
const profile=r=>r&&({uid:r.user_id,username:r.username,displayName:r.display_name||r.username,email:"",phone:"",photoURL:r.avatar_url||"",lastActiveAt:r.last_seen_at,isOnline:!!r.last_seen_at&&Date.now()-Date.parse(r.last_seen_at)<120000,friendNicknames:r.friend_nicknames||{},encryptionPublicKey:r.encryption_public_key||null,createdAt:r.created_at});
const request=r=>r&&({id:r.sender_id+"_"+r.receiver_id,fromUid:r.sender_id,toUid:r.receiver_id,status:r.status,createdAt:r.created_at,acceptedAt:r.updated_at,respondedAt:r.updated_at});
const friendship=r=>r&&({id:[r.user_one,r.user_two].sort().join("_"),members:[r.user_one,r.user_two],status:"accepted",createdAt:r.created_at});
const message=r=>r&&({id:r.id,senderUid:r.sender_uid,receiverUid:r.receiver_uid,type:r.message_type,text:"",encryptedText:r.encrypted_text,iv:r.iv,cryptoVersion:r.crypto_version,mediaUrl:r.media_url,storagePath:r.storage_path,mediaContentType:r.media_content_type,mediaSize:r.media_size,createdAt:r.created_at});
const mapped=(n,rows)=>rows.map(n==="users"?profile:n==="friendRequests"?request:n==="friendships"?friendship:n==="messages"?message:x=>x);
const toProfile=v=>{const x={};if("username"in v)x.username=v.username;if("displayName"in v)x.display_name=v.displayName;if("photoURL"in v)x.avatar_url=v.photoURL||null;if("lastActiveAt"in v)x.last_seen_at=v.lastActiveAt;if("friendNicknames"in v)x.friend_nicknames=v.friendNicknames;if("encryptionPublicKey"in v)x.encryption_public_key=v.encryptionPublicKey;return x};
class Snap{constructor(rows){this.docs=rows.map(x=>({id:x.id,exists:true,data:()=>x}));this.empty=!rows.length;this.size=rows.length}forEach(f){this.docs.forEach(f)}}
class Ref{
 constructor(name,chat=null,doc=null,filters=[],sort=null){Object.assign(this,{name,chat,docId:doc,filters,sort})}
 collection(n){if(this.name!=="chats"||n!=="messages")throw Error("Unsupported collection");return new Ref("messages",this.docId)}
 doc(id){return new Ref(this.name,this.chat,id||crypto.randomUUID())}
 where(f,o,v){return new Ref(this.name,this.chat,this.docId,[...this.filters,[f,o,v]],this.sort)}
 orderBy(f,d="asc"){return new Ref(this.name,this.chat,this.docId,this.filters,[f,d])}
 async rows(){
 let table={users:"profiles",friendRequests:"friend_requests",friendships:"friendships",messages:"messages",chats:"conversations"}[this.name];
 let q=supabase.from(table).select("*");
 if(this.docId){if(this.name==="users")q=q.eq("user_id",this.docId);else if(this.name==="friendRequests"){let [a,b]=this.docId.split("_");q=q.eq("sender_id",a).eq("receiver_id",b)}else if(this.name==="friendships"){let [a,b]=this.docId.split("_");q=q.eq("user_one",a).eq("user_two",b)}else if(this.name==="chats")q=q.eq("id",this.docId);else q=q.eq("id",this.docId).eq("conversation_id",this.chat)}
 if(this.name==="messages")q=q.eq("conversation_id",this.chat);
 for(const [f,o,v] of this.filters){let col=this.name==="friendRequests"?(f==="toUid"?"receiver_id":"sender_id"):this.name==="messages"?(f==="senderUid"?"sender_uid":"receiver_uid"):f;if(this.name==="friendships"&&f==="members"&&o==="array-contains")q=q.or("user_one.eq."+v+",user_two.eq."+v);else if(o==="==")q=q.eq(col,v)}
 if(this.sort)q=q.order(this.sort[0]==="createdAt"?"created_at":this.sort[0],{ascending:this.sort[1]!=="desc"});
 const {data,error}=await q;if(error)throw error;return mapped(this.name,data||[]);
 }
 async get(){const a=await this.rows();return this.docId?{id:this.docId,exists:!!a[0],data:()=>a[0]}:new Snap(a)}
 onSnapshot(cb,err){let active=true;const refresh=()=>this.rows().then(a=>{if(active)cb(new Snap(a))}).catch(e=>{if(active&&err)err(e)});refresh();const table={users:"profiles",friendRequests:"friend_requests",friendships:"friendships",messages:"messages"}[this.name];const ch=supabase.channel("vs-"+id()).on("postgres_changes",{event:"*",schema:"public",table},refresh).subscribe();return()=>{active=false;supabase.removeChannel(ch)}}
 async set(v){let e;
 if(this.name==="users"){let x=toProfile(v);x.user_id=this.docId;if(!x.username){const {data}=await supabase.auth.getUser();x.username=data.user?.user_metadata?.username||"user_"+this.docId.slice(0,8)}({error:e}=await supabase.from("profiles").upsert(x,{onConflict:"user_id"}))}
 else if(this.name==="friendRequests"){let [a,b]=this.docId.split("_");({error:e}=await supabase.from("friend_requests").upsert({sender_id:v.fromUid||a,receiver_id:v.toUid||b,status:v.status||"pending"},{onConflict:"sender_id,receiver_id"}))}
 else if(this.name==="friendships"){let [a,b]=(v.members||this.docId.split("_")).sort();({error:e}=await supabase.from("friendships").upsert({user_one:a,user_two:b},{onConflict:"user_one,user_two"}))}
 else if(this.name==="chats"){let m=v.members||[];({error:e}=await supabase.from("conversations").upsert({id:this.docId,created_by:m[0],updated_at:stamp()}));if(!e)for(const u of m){({error:e}=await supabase.from("conversation_members").upsert({conversation_id:this.docId,user_id:u}));if(e)break}}
 else if(this.name==="messages"){({error:e}=await supabase.from("messages").insert({id:this.docId,conversation_id:this.chat,sender_uid:v.senderUid,receiver_uid:v.receiverUid||null,message_type:v.type||"text",encrypted_text:v.encryptedText||null,iv:v.iv||null,crypto_version:v.cryptoVersion||null,media_url:v.mediaUrl||null,storage_path:v.storagePath||null,media_content_type:v.mediaContentType||null,media_size:v.mediaSize||null}))}
 if(e)throw e}
 async update(v){let q,e;if(this.name==="users")({error:e}=await supabase.from("profiles").update(toProfile(v)).eq("user_id",this.docId));else if(this.name==="friendRequests"){let[a,b]=this.docId.split("_");({error:e}=await supabase.from("friend_requests").update({status:v.status,updated_at:stamp()}).eq("sender_id",a).eq("receiver_id",b))}else throw Error("Unsupported update");if(e)throw e}
 async add(v){let d=this.doc(id());await d.set(v);return d}
}
const db={collection:n=>new Ref(n),batch(){let jobs=[];return{set:(r,v)=>jobs.push(()=>r.set(v)),update:(r,v)=>jobs.push(()=>r.update(v)),async commit(){for(const j of jobs)await j()}}}};
const wrap=u=>u&&({uid:u.id,email:u.email||"",displayName:u.user_metadata?.username||"",async updateProfile(v){if(v.displayName){const{error}=await supabase.from("profiles").update({display_name:v.displayName}).eq("user_id",u.id);if(error)throw error}}});
const auth={async signInWithEmailAndPassword(email,password){let{data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw Object.assign(error,{code:"auth/invalid-credential"});return{user:wrap(data.user)}},async createUserWithEmailAndPassword(email,password){let{data,error}=await supabase.auth.signUp({email,password,options:{data:{username:email.split("@")[0]}}});if(error)throw Object.assign(error,{code:error.code==="user_already_exists"?"auth/email-already-in-use":error.code});if(!data.user)throw Error("Account creation failed. Check Supabase email confirmation settings.");return{user:wrap(data.user)}},onAuthStateChanged(cb){let alive=true;supabase.auth.getSession().then(({data})=>alive&&cb(wrap(data.session?.user)));let{data}=supabase.auth.onAuthStateChange((e,s)=>alive&&cb(wrap(s?.user)));return()=>{alive=false;data.subscription.unsubscribe()}},async signOut(){let{error}=await supabase.auth.signOut();if(error)throw error}};
const storage={ref(){return{child(path){return{async put(blob,o){let{error}=await supabase.storage.from("vibesnap-media").upload(path,blob,{contentType:o.contentType});if(error)throw error},async getDownloadURL(){let{data,error}=await supabase.storage.from("vibesnap-media").createSignedUrl(path,31536000);if(error)throw error;return data.signedUrl}}}}}};
const firebase={firestore:{FieldValue:{serverTimestamp:stamp},Timestamp:{now(){let d=new Date();return{toMillis:()=>d.getTime(),toDate:()=>d}}}}};
export{firebase,auth,db,storage};
