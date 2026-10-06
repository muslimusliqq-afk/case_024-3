(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('node:crypto').webcrypto);
  else root.Quest = factory(root.crypto);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (crypto) {
  'use strict';
  const HASHES = {
    timestamp: '498abd4d86da09e0dca4bcf1aade64880f07c825d08d40397689a12fad8753f2',
    wallet: '737c978e96f4867e8af73f32177fa598abc1aa46b3db0afdb2ce230de2acd3fd',
    location: '7104741a92e73eb6c5d69cd04cf0afbe50a8796a010d8fa25daaf79e5e173bf3',
    final: '2797f22976c569a49761759b1212af4a2719f4dde3958b176569f711d2cc0af9'
  };
  const WALLETS = Object.freeze([
    {id:'w0', address:'0x7b51e9…e42a', kind:'math', question:'8 × 8 = ?', answer:'64'},
    {id:'w1', address:'0x91cf26…110d', kind:'capital', question:'CAPITAL OF MADAGASCAR?', answer:'antananarivo'},
    {id:'w2', address:'0xa880b4…673b', kind:'power', question:'2^5 = ?', answer:'32'},
    {id:'w3', address:'0x32de08…f941', kind:'trap'},
    {id:'w4', address:'0xf5ac5a…c0ee', kind:'real'}
  ]);
  function shuffle(items, rng = Math.random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {const j = Math.floor(rng() * (i + 1)); [result[i],result[j]] = [result[j],result[i]];}
    return result;
  }
  function rearrange(previous, rng = Math.random) {
    for(let i=0;i<40;i++){const next=shuffle(previous,rng);if(next.every((id,j)=>id!==previous[j]))return next;}
    return [...previous.slice(1),previous[0]];
  }
  function initial(rng) {return {version:3,stage:0,view:0,order:shuffle(WALLETS.map(w=>w.id),rng),scanned:[],active:null,corrupted:false,fragments:[]};}
  function restore(raw) {
    try {
      const s=JSON.parse(raw);
      // This release starts a clean session for older versions, whose codes differ.
      if(!s || s.version!==3 || !Number.isInteger(s.stage) || s.stage<0 || s.stage>6) return initial();
      const ids=WALLETS.map(w=>w.id);
      if(!Array.isArray(s.order)||s.order.length!==5||new Set(s.order).size!==5||!s.order.every(id=>ids.includes(id)))return initial();
      if(!Array.isArray(s.scanned)||!s.scanned.every(id=>ids.includes(id)))return initial();
      if(!Array.isArray(s.fragments)||s.fragments.length!==Math.max(0,Math.min(s.stage-2,3))||!s.fragments.every(f=>typeof f==='string'&&/^\d+$/.test(f)))return initial();
      if(s.active && (s.stage!==3||!ids.includes(s.active.id)||!Number.isInteger(s.active.step)||s.active.step<0||s.active.step>3))return initial();
      const view=Number.isInteger(s.view)&&s.view>0&&s.view<=s.stage?s.view:s.stage;
      const restored={version:3,stage:s.stage,view,order:s.order,scanned:s.scanned,active:s.active||null,corrupted:s.stage===3&&!!s.corrupted,fragments:s.fragments};
      if(restored.active||restored.corrupted)restored.view=3;
      return restored;
    } catch {return initial();}
  }
  function begin(s) {if(s.stage===0)s.view=s.stage=1;}
  function recoverEvidence(s) {if(s.stage===1)s.view=s.stage=2;}
  function canNavigate(s,view) {return !s.active&&!s.corrupted&&Number.isInteger(view)&&view>=1&&view<=s.stage;}
  function navigate(s,view) {if(!canNavigate(s,view))return false;s.view=view;return true;}
  async function digest(value) {
    if(!crypto?.subtle)throw new Error('CRYPTO_UNAVAILABLE');
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
    return {bytes,hex:Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')};
  }
  async function submit(s, value) {
    const input=String(value).trim();
    const before=s.stage;
    const key=({2:'timestamp',4:'location',5:'final'})[before];
    if(!key||s.view!==before||!/^\d+$/.test(input)||(before===2&&input.length!==6))return false;
    if((await digest(input)).hex!==HASHES[key]||s.stage!==before||s.view!==before)return false;
    if(before!==5)s.fragments.push(input);
    s.view=++s.stage;
    return true;
  }
  function openWallet(s,id) {
    if(s.stage!==3||s.view!==3||s.active||s.corrupted||s.scanned.includes(id)||!WALLETS.some(w=>w.id===id))return false;
    s.active={id,step:0};return true;
  }
  function confirmWallet(s,rng) {
    if(s.stage!==3||!s.active)return false;
    const wallet=WALLETS.find(w=>w.id===s.active.id);
    if(wallet.kind==='trap') {
      s.active.step++;
      if(s.active.step===3){s.order=rearrange(s.order,rng);s.scanned=[];s.active=null;s.corrupted=true;}
    } else if(s.active.step===0)s.active.step=1;
    return true;
  }
  async function answerWallet(s,value) {
    if(s.stage!==3||!s.active||s.active.step!==1)return false;
    const active=s.active;
    const wallet=WALLETS.find(w=>w.id===active.id);
    const input=String(value).trim().toLowerCase();
    if(wallet.kind==='trap')return false;
    if(wallet.kind==='real') {
      if(!/^0x[0-9a-f]{40}$/.test(input))return false;
      const d=await digest(input);
      if(d.hex!==HASHES.wallet||s.active!==active||s.stage!==3)return false;
      s.fragments.push(String.fromCharCode(...[75,68,166,184].map((b,i)=>b^d.bytes[i])));
      s.scanned.push(wallet.id);s.active=null;s.view=s.stage=4;return true;
    }
    if(input!==wallet.answer && !(wallet.kind==='capital'&&['антананариву','антананариво'].includes(input)))return false;
    s.scanned.push(wallet.id);s.active.step=2;return true;
  }
  function returnToScan(s) {
    if(s.corrupted){s.corrupted=false;return true;}
    if(!s.active)return false;
    const wallet=WALLETS.find(w=>w.id===s.active.id);
    if((wallet.kind!=='trap'&&s.active.step===2)||(wallet.kind==='real'&&s.active.step===1)){s.active=null;return true;}
    return false;
  }
  return {WALLETS,initial,restore,begin,recoverEvidence,submit,openWallet,confirmWallet,answerWallet,returnToScan,canNavigate,navigate};
});
