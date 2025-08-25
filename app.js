const $=id=>document.getElementById(id);

// Tab switching
document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  document.querySelectorAll('main section').forEach(s=>s.classList.remove('active'));
  document.getElementById(b.dataset.tab).classList.add('active');
}));

// State
let STATE = JSON.parse(localStorage.getItem('atlas_v3')||'{"notes":""}');
function save(){localStorage.setItem('atlas_v3',JSON.stringify(STATE));}

// Notes
$('notes_save').addEventListener('click',()=>{STATE.notes=$('notes_area').value;save();});
function renderNotes(){ $('notes_area').value = STATE.notes||''; }

// Export / Import
$('btn_export').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify({data:STATE})],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='atlas-backup.json';a.click();
});
$('btn_import').addEventListener('click',()=>$('import_file').click());
$('import_file').addEventListener('change',async e=>{
  const f=e.target.files[0]; if(!f)return;
  const text=await f.text(); const obj=JSON.parse(text);
  if(obj.data){STATE=obj.data;save();renderNotes();alert('Imported!');}
});
$('btn_reset').addEventListener('click',()=>{if(confirm('Reset all data?')){localStorage.removeItem('atlas_v3');location.reload();}});

// Settings modal
$('open_settings').addEventListener('click',()=>$('settings').style.display='grid');
$('settings_close').addEventListener('click',()=>$('settings').style.display='none');

// Passcode
const te=new TextEncoder();
async function sha256(s){const buf=await crypto.subtle.digest('SHA-256',te.encode(s));return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');}
$('pin_set').addEventListener('click',async()=>{const pin=$('pin_new').value.trim();if(pin.length<4)return alert('Use 4-6 digits');localStorage.setItem('atlas_v3_pin',await sha256(pin));alert('Passcode set');});
$('pin_clear').addEventListener('click',()=>{localStorage.removeItem('atlas_v3_pin');alert('Passcode removed');});
$('pin_go').addEventListener('click',async()=>{const pin=$('pin_enter').value.trim();if(await sha256(pin)===localStorage.getItem('atlas_v3_pin')){$('lock').style.display='none';}else{alert('Wrong');}});

function checkLock(){if(localStorage.getItem('atlas_v3_pin')){$('lock').style.display='grid';}}

function init(){renderNotes();checkLock();}
init();
