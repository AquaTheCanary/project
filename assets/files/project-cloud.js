// Shared account-scoped cloud project storage and community-copy API.
(function(){
  "use strict";
  const db=()=>firebase.firestore();
  async function user(){
    if(!window.studioAuth)throw new Error("Account service is unavailable. Refresh and sign in again.");
    const active=await window.studioAuth.currentUser();
    if(!active)throw new Error("Sign in to save projects to your account.");
    return active;
  }
  const projectRef=(uid,id)=>db().collection("users").doc(uid).collection("projects").doc(String(id));
  window.projectCloud={
    async save(id,type,title,content,metadata={}){
      const u=await user();
      const data={id:String(id),ownerUid:u.uid,type,title:String(title||"Untitled project").slice(0,160),content,metadata,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
      await projectRef(u.uid,id).set(data,{merge:true});
      return data;
    },
    async load(id){
      const u=await user(),snap=await projectRef(u.uid,id).get();
      return snap.exists?snap.data():null;
    },
    async list(type){
      const u=await user();let q=db().collection("users").doc(u.uid).collection("projects");
      if(type)q=q.where("type","==",type);
      const snap=await q.orderBy("updatedAt","desc").limit(100).get();
      return snap.docs.map(d=>({...d.data(),id:d.id}));
    },
    async remove(id){const u=await user();await projectRef(u.uid,id).delete();},
    async shareCopy(type,title,content,description){
      const u=await user();
      const copy={copyOwnerUid:u.uid,ownerName:u.displayName||"Project creator",product:type,title:String(title||"Untitled project").slice(0,160),description:String(description||"").slice(0,500),content,visibility:"public",createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
      const ref=db().collection("communityDesigns").doc();
      await ref.set(copy);
      return ref.id;
    },
    async publicCopy(id){
      const snap=await db().collection("communityDesigns").doc(String(id)).get();
      return snap.exists&&snap.data().visibility==="public"?{id:snap.id,...snap.data()}:null;
    }
  };
})();