/* ---------- Core UI ---------- */
const $=id=>document.getElementById(id);
document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  document.querySelectorAll('main section').forEach(s=>s.classList.remove('active'));
  document.getElementById(b.dataset.tab).classList.add('active');
}));

/* ---------- State & Migration ---------- */
let STATE = JSON.parse(localStorage.getItem('atlas_v3')||'null');
if(!STATE){
  const v2 = localStorage.getItem('atlas_v2');
  const v1 = localStorage.getItem('atlas_simple');
  if(v2){ STATE = JSON.parse(v2); }
  else if(v1){ const o=JSON.parse(v1); STATE={version:'3',accounts:[],txs:[],calendar:{},events:o.events||[],tasks:(o.tasks||[]).map(t=>({text:t,done:false})),notes:o.notes||'',score:700,streakDays:0,lastStreakDate:''}; }
  else { STATE={version:'3',accounts:[],txs:[],calendar:{},events:[],tasks:[],notes:'',score:700,streakDays:0,lastStreakDate:''}; }
  save();
}
function save(){ localStorage.setItem('atlas_v3', JSON.stringify(STATE)); }
function fmt(n){ return '$'+(Number(n||0)).toLocaleString(undefined,{maximumFractionDigits:2}); }

/* ---------- Money ---------- */
function addAccount(){
  const type=$('acct_type').value;
  const name=($('acct_name').value||'').trim()||'Unnamed';
  const open=+($('acct_open').value||0);
  const limit=+($('acct_limit').value||0);
  const acct={id:'a'+Date.now(),type,name,balance:open,limit:type==='Credit Card'?limit:0};
  STATE.accounts.push(acct); save();
  $('acct_name').value='';$('acct_open').value='';$('acct_limit').value='';
  renderAccounts(); renderTxForm(); renderCredit(); renderFeed();
}
function deleteAccount(id){
  STATE.accounts=STATE.accounts.filter(a=>a.id!==id);
  STATE.txs=STATE.txs.filter(t=>t.acct!==id);
  save(); renderAccounts(); renderTxs(); renderTxForm(); renderCredit(); renderFeed();
}
function renderAccounts(){
  const wrap=$('acct_cards'); wrap.innerHTML='';
  if(!STATE.accounts.length){ wrap.innerHTML='<div class="small">No accounts yet.</div>'; return; }
  STATE.accounts.forEach(a=>{
    const div=document.createElement('div'); div.className='card'; div.style.flex='1';
    div.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <div class="pill">${a.type}</div>
        <div class="pill">${a.name}</div>
        <div class="pill num">${fmt(a.balance)}</div>
        ${a.type==='Credit Card'?`<div class="pill">Limit $${(a.limit||0).toLocaleString()}</div>`:''}
        <button data-delacct="${a.id}" class="primary" style="flex:0 0 auto">Delete</button>
      </div>`;
    wrap.appendChild(div);
  });
}
function renderTxForm(){
  const sel=$('tx_acct'); sel.innerHTML='';
  STATE.accounts.forEach(a=>{ const o=document.createElement('option'); o.value=a.id; o.textContent=a.name; sel.appendChild(o); });
}
function addTx(){
  const acct=$('tx_acct').value, date=$('tx_date').value, desc=$('tx_desc').value, cat=$('tx_cat').value, amt=+($('tx_amt').value||0);
  if(!acct||!date||!amt){ alert('Account, date, amount are required'); return; }
  STATE.txs.push({id:'t'+Date.now(),acct,date,desc,cat,amt});
  const a=STATE.accounts.find(x=>x.id===acct); if(a){ a.balance=+(a.balance+amt).toFixed(2); }
  save(); $('tx_desc').value='';$('tx_amt').value='';
  renderTxs(); renderAccounts(); renderCredit(); renderFeed();
}
function deleteTx(id){
  const tx=STATE.txs.find(x=>x.id===id);
  if(tx){ const a=STATE.accounts.find(x=>x.id===tx.acct); if(a) a.balance=+(a.balance - tx.amt).toFixed(2); }
  STATE.txs=STATE.txs.filter(t=>t.id!==id); save();
  renderTxs(); renderAccounts(); renderCredit(); renderFeed();
}
function renderTxs(){
  const rows=$('tx_rows'); rows.innerHTML='';
  STATE.txs.slice().sort((a,b)=>a.date<b.date?1:-1).forEach(t=>{
    const acct=STATE.accounts.find(a=>a.id===t.acct);
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${t.date}</td><td>${acct?acct.name:'?'}</td><td>${t.desc||''}</td><td>${t.cat}</td>
                  <td class="num">${t.amt>=0?'+':''}${fmt(Math.abs(t.amt))}</td>
                  <td><button data-deltx="${t.id}">Delete</button></td>`;
    rows.appendChild(tr);
  });
}

/* ---------- Credit ---------- */
function computeUtil(){
  const cards=STATE.accounts.filter(a=>a.type==='Credit Card');
  const bal=cards.reduce((s,a)=>s+Math.max(0,a.balance||0),0);
  const lim=cards.reduce((s,a)=>s+(a.limit||0),0);
  return {overall:lim>0?(bal/lim)*100:null,cards};
}
function renderCredit(){
  const {overall,cards}=computeUtil();
  $('score_val').textContent = STATE.score || 700;
  $('util_overall').textContent = overall==null ? '—' : overall.toFixed(1)+'%';
  $('util_overall').className = 'num '+(overall==null?'':(overall<=10?'good':overall<=30?'':'bad'));
  const rows=$('util_rows'); rows.innerHTML='';
  cards.forEach(c=>{
    const util = c.limit>0 ? ((Math.max(0,c.balance)/c.limit)*100).toFixed(1)+'%' : '—';
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${c.name}</td><td class="num">${fmt(Math.max(0,c.balance||0))}</td><td class="num">${(c.limit||0).toLocaleString()}</td><td class="num">${util}</td>`;
    rows.appendChild(tr);
  });
}
$('score_set').addEventListener('click',()=>{ const v=parseInt($('score_in').value||'700'); STATE.score=v; save(); renderCredit(); });

/* ---------- Planner v1 (Month grid + recurring) ---------- */
const CAL = {
  ym: new Date(), // current visible year-month
  add(iso, item){ (STATE.calendar[iso] = STATE.calendar[iso] || []).push(item); save(); renderCalendar(); renderFeed(); },
  addMonthly(iso, item, months=18){
    const base=new Date(iso);
    for(let i=0;i<months;i++){
      const d=new Date(base.getFullYear(), base.getMonth()+i, base.getDate());
      const s=d.toISOString().slice(0,10);
      this.add(s, {...item});
    }
  }
};
function renderCalendar(){
  const y=CAL.ym.getFullYear(), m=CAL.ym.getMonth();
  const names=['January','February','March','April','May','June','July','August','September','October','November','December'];
  $('cal_m').textContent = names[m]; $('cal_y').textContent = y;

  const first=new Date(y,m,1);
  const start=new Date(first); start.setDate(1-first.getDay()); // start from Sunday grid

  const daysEl=$('cal_days'); daysEl.innerHTML='';
  const todayISO = new Date().toISOString().slice(0,10);

  for(let i=0;i<42;i++){
    const d=new Date(start); d.setDate(start.getDate()+i);
    const iso=d.toISOString().slice(0,10);
    const cell=document.createElement('div');
    cell.className='day'+(d.getMonth()!==m?' muted':'');
    cell.innerHTML = `
      <div class="n">${d.getDate()}</div>
      <div class="chips"></div>
      ${iso===todayISO?'<div class="today-ring"></div>':''}
    `;
    cell.addEventListener('click',()=>{
      const t=prompt('Quick add title for '+iso+' (blank = cancel)');
      if(t){ CAL.add(iso,{title:t,type:'Other'}); }
    });
    const list = (STATE.calendar[iso]||[]);
    const chips = cell.querySelector('.chips');
    list.forEach(ev=>{
      const c=document.createElement('div'); c.className='chip '+(ev.type||'Other');
      c.textContent=(ev.type?ev.type+': ':'')+(ev.title||'');
      chips.appendChild(c);
    });
    daysEl.appendChild(cell);
  }
}
$('evt_add').addEventListener('click',()=>{
  const title=($('evt_title').value||'').trim();
  const type=$('evt_type').value;
  const date=$('evt_date').value;
  const rep=$('evt_repeat').value;
  if(!title || !date){ alert('Title + Date'); return; }
  const item={title,type};
  if(rep==='monthly') CAL.addMonthly(date,item);
  else CAL.add(date,item);
  $('evt_title').value=''; $('evt_date').value=''; $('evt_repeat').value='none';
});
$('cal_prev').addEventListener('click',()=>{ CAL.ym=new Date(CAL.ym.getFullYear(),CAL.ym.getMonth()-1,1); renderCalendar(); });
$('cal_next').addEventListener('click',()=>{ CAL.ym=new Date(CAL.ym.getFullYear(),CAL.ym.getMonth()+1,1); renderCalendar(); });

/* ---------- Tasks & Notes ---------- */
function addTask(){ const txt=($('task_text').value||'').trim(); if(!txt) return;
  STATE.tasks.push({text:txt,done:false}); save(); $('task_text').value=''; renderTasks(); renderFeed();
}
function renderTasks(){
  const ul=$('task_list'); ul.innerHTML='';
  STATE.tasks.forEach((t,i)=>{
    const li=document.createElement('li');
    li.innerHTML=`<label><input type="checkbox" data-tdx="${i}" ${t.done?'checked':''}> ${t.text}</label>`;
    ul.appendChild(li);
  });
}
$('notes_save').addEventListener('click',()=>{ STATE.notes=$('notes_area').value||''; save(); });
function renderNotes(){ $('notes_area').value = STATE.notes||''; }

/* ---------- Feed ---------- */
function renderFeed(){
  const cash=STATE.accounts.filter(a=>a.type!=='Credit Card').reduce((s,a)=>s+(a.balance||0),0);
  $('feed_cash').textContent=fmt(cash);

  const debt=STATE.accounts.filter(a=>a.type==='Credit Card').reduce((s,a)=>s+Math.max(0,a.balance||0),0);
  $('feed_debt').textContent=fmt(debt);

  // Next 7 days from calendar
  const out=[];
  for(let i=0;i<7;i++){
    const d=new Date(); d.setDate(d.getDate()+i);
    const iso=d.toISOString().slice(0,10);
    (STATE.calendar[iso]||[]).forEach(e=>out.push(`${iso}: ${e.type?e.type+': ':''}${e.title}`));
  }
  $('feed_event').textContent = out.slice(0,3).join(' • ') || '—';

  // Simple task streak: if all tasks done today → +1; else reset (lightweight demo)
  const all = STATE.tasks.length>0 && STATE.tasks.every(t=>t.done);
  const todayISO=new Date().toISOString().slice(0,10);
  if(all && STATE.lastStreakDate!==todayISO){ STATE.streakDays=(STATE.streakDays||0)+1; STATE.lastStreakDate=todayISO; save(); }
  $('feed_streak').textContent = `${STATE.streakDays||0} days`;
}

/* ---------- Settings (Export/Import/Reset) ---------- */
$('open_settings').addEventListener('click',()=>{$('settings').style.display='grid';});
$('settings_close').addEventListener('click',()=>{$('settings').style.display='none';});

$('btn_export').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify({v:'3',data:STATE})],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='atlas-backup.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),500);
});
$('btn_import').addEventListener('click',()=>$('import_file').click());
$('import_file').addEventListener('change',async e=>{
  const f=e.target.files[0]; if(!f) return;
  try{
    const text=await f.text(); const obj=JSON.parse(text);
    if(!obj || !obj.data) throw new Error('bad file');
    STATE=obj.data; save(); init(); alert('Imported!');
  }catch(err){ alert('Import failed.'); }
});
$('btn_reset').addEventListener('click',()=>{ if(confirm('Erase all local data?')){ localStorage.removeItem('atlas_v3'); location.reload(); }});

/* ---------- Passcode unlock (uses pin from Pack A if set) ---------- */
const te=new TextEncoder();
async function sha256(s){const buf=await crypto.subtle.digest('SHA-256',te.encode(s));return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');}
async function checkLock(){const pinHash=localStorage.getItem('atlas_v3_pin'); if(pinHash){$('lock').style.display='grid';}}
$('pin_go').addEventListener('click',async()=>{
  const pin=$('pin_enter').value.trim();
  const h=await sha256(pin);
  if(h===localStorage.getItem('atlas_v3_pin')){$('lock').style.display='none';$('pin_enter').value='';}
  else alert('Wrong code');
});

/* ---------- Global listeners ---------- */
document.addEventListener('click',e=>{
  const id=e.target.getAttribute('data-delacct'); if(id) deleteAccount(id);
  const tx=e.target.getAttribute('data-deltx'); if(tx) deleteTx(tx);
});
document.addEventListener('change',e=>{
  const i=e.target.getAttribute('data-tdx');
  if(i!==null){ STATE.tasks[i].done = e.target.checked; save(); renderFeed(); }
});

/* ---------- Init ---------- */
function init(){
  renderAccounts(); renderTxForm(); renderTxs(); renderCredit();
  renderTasks(); renderNotes(); renderCalendar(); renderFeed();
  checkLock();
}
$('acct_add').addEventListener('click',addAccount);
$('tx_add').addEventListener('click',addTx);
$('task_add').addEventListener('click',addTask);
init();
