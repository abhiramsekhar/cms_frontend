const CMS={mods:{},base:'',home:{ADMIN:'admin/dashboard.html',RECEPTIONIST:'reception/patients.html',DOCTOR:'doctor/my-appointments.html',PHARMACIST:'pharmacy/prescription-queue.html',LAB_TECH:'lab/lab-queue.html'}};
CMS.slug=l=>l.toLowerCase().replace(/[^a-z]+/g,'-').replace(/^-|-$/g,'');
(()=>{
const K='cms_db_v1',P=(p,n)=>p+String(n).padStart(4,'0');
const seed=()=>({
users:[['admin','admin123','ADMIN','Asha Admin'],['doctor','doc123','DOCTOR','Dr. Rahul Menon'],['recep','rec123','RECEPTIONIST','Meera Nair'],['pharma','pha123','PHARMACIST','Vishnu Das'],['lab','lab123','LAB_TECH','Anu Thomas']].map((a,i)=>({id:P('U',i+1),username:a[0],password:a[1],role:a[2],name:a[3],is_active:true})),
patients:[],appointments:[],prescriptions:[],labOrders:[],bills:[],
medicines:[['Paracetamol 500mg',120,2],['Amoxicillin 250mg',60,8],['Cetirizine 10mg',80,3],['Omeprazole 20mg',5,6]].map((a,i)=>({id:P('M',i+1),name:a[0],stock:a[1],price:a[2],expiry:'2027-12-31',is_active:true})),
labCatalog:[['CBC',300],['Blood Sugar',100],['Lipid Profile',500]].map((a,i)=>({id:P('T',i+1),name:a[0],price:a[1]})),
seq:{U:5,M:4,T:3}});
let db;try{db=JSON.parse(localStorage.getItem(K))}catch(e){}db=db||seed();
const save=()=>localStorage.setItem(K,JSON.stringify(db));
document.documentElement.dataset.t=localStorage.cms_t||'';
CMS.reset=()=>{db=seed();save()};
CMS.all=t=>db[t];CMS.get=(t,id)=>db[t].find(x=>x.id===id);
CMS.add=(t,o,p)=>{db.seq[p]=(db.seq[p]||0)+1;o.id=P(p,db.seq[p]);db[t].push(o);save();return o};
CMS.tx=fn=>{const s=JSON.stringify(db);try{const r=fn();save();return r}catch(e){db=JSON.parse(s);throw e}};
CMS.today=()=>new Date().toLocaleDateString('en-CA');
CMS.login=(u,p)=>{const x=db.users.find(x=>x.username===u.trim()&&x.password===p);if(!x)throw Error('Wrong username or password');if(!x.is_active)throw Error('This account is deactivated');sessionStorage.cms_u=x.id;return x};
CMS.user=()=>CMS.get('users',sessionStorage.cms_u);
CMS.logout=()=>{sessionStorage.removeItem('cms_u');location.href=CMS.base+'index.html'};
const esc=CMS.esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
CMS.V={
name:v=>/^[A-Za-z][A-Za-z .'-]{1,59}$/.test(v)?'':'Use letters only (2–60 characters)',
phone:v=>/^[6-9]\d{9}$/.test(v)?'':'Enter a 10-digit mobile number starting 6–9',
email:v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)?'':'Enter a valid email',
dob:v=>v>CMS.today()?'Date of birth cannot be in the future':v<'1906-01-01'?'Age looks impossible':'',
future:v=>v<CMS.today()?'Pick today or a later date':'',
pos:v=>/^\d+$/.test(v)&&+v>0?'':'Enter a whole number above 0',
money:v=>/^\d+(\.\d{1,2})?$/.test(v)&&+v>0?'':'Enter an amount above 0',
user:v=>/^[a-z0-9_]{4,20}$/.test(v)?'':'4–20 lowercase letters, digits or _',
pass:v=>v.length>=6?'':'At least 6 characters',
notPhone:(v,a)=>v===a.phone?'Must differ from patient phone':''};
CMS.toast=(m,ok=true)=>{const t=document.createElement('div');t.className='toast '+(ok?'ok':'bad');t.textContent=m;document.body.append(t);setTimeout(()=>t.remove(),3200)};
CMS.badge=s=>`<span class="badge ${esc(s)}">${esc(s)}</span>`;
CMS.btn=(a,id,l,c='')=>`<button class="btn sm ${c}" data-a="${a}" data-id="${esc(id)}">${esc(l)}</button>`;
CMS.form=(title,fields,submit,done)=>{
const m=document.createElement('div');m.className='modal';
m.innerHTML=`<form class="card" novalidate><h3>${esc(title)}</h3><br>${fields.map(f=>`<label>${esc(f.l)}${f.opt?'':' *'}${f.t==='select'?`<select name="${f.n}"><option value="">Select…</option>${(f.o||[]).map(o=>{o=[].concat(o);return`<option value="${esc(o[0])}">${esc(o[o.length-1])}</option>`}).join('')}</select>`:f.t==='textarea'?`<textarea name="${f.n}" rows="2"></textarea>`:`<input name="${f.n}" type="${f.t||'text'}" ${f.a||''}>`}<small class="err"></small></label>`).join('')}<div class="row"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">Save</button></div></form>`;
const fm=m.firstChild,bt=fm.querySelector('.btn:not([type])');
fm.onsubmit=e=>{e.preventDefault();const v={};let bad=0;
fields.forEach(f=>{const el=fm.elements[f.n];v[f.n]=el.value.trim()});
fields.forEach(f=>{const x=v[f.n];const er=!x?(f.opt?'':'Required'):[].concat(f.v||[]).map(g=>g(x,v)).find(Boolean)||'';fm.elements[f.n].parentNode.querySelector('.err').textContent=er;if(er)bad++});
if(bad)return;bt.disabled=true;
try{submit(v)}catch(x){CMS.toast(x.message,false);bt.disabled=false;return}
m.remove();CMS.toast('Saved');done&&done()};
fm.querySelector('[data-x]').onclick=()=>m.remove();document.body.append(m);fm.elements[fields[0].n].focus()};

/* ── Role icons & nav icons ─────────────────────────────────── */
const ROLE_ICONS = {
  ADMIN: '👨‍💼', DOCTOR: '🩺', RECEPTIONIST: '📋', PHARMACIST: '💊', LAB_TECH: '🔬'
};
const NAV_ICONS = {
  'Dashboard': '📊', 'Staff & users': '👥', 'Lab catalog': '🧪',
  'Patients': '🏥', 'Appointments': '📅', 'Billing': '💰',
  'My appointments': '📋', 'Orders & results': '📝',
  'Prescription queue': '💊', 'Inventory': '📦',
  'Lab queue': '🔬'
};
const initials = name => name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

CMS.page=(el,o)=>{
el.innerHTML=`<div class="head"><h2>${esc(o.title)}</h2><div><input class="search" placeholder="Search…" aria-label="Search">${o.btn?`<button class="btn" data-new>${esc(o.btn[0])}</button>`:''}</div></div><div class="card scroll"><table><thead><tr>${o.cols.map(c=>`<th>${esc(c[0])}</th>`).join('')}</tr></thead><tbody>${o.rows.length?o.rows.map(r=>`<tr>${o.cols.map(c=>`<td>${c[2]?c[1](r):esc(c[1](r))}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${o.cols.length}" class="empty">${esc(o.empty||'Nothing here yet')}</td></tr>`}</tbody></table></div>`;
el.querySelector('.search').oninput=e=>{const q=e.target.value.toLowerCase();el.querySelectorAll('tbody tr').forEach(t=>t.hidden=!t.textContent.toLowerCase().includes(q))};
if(o.btn)el.querySelector('[data-new]').onclick=o.btn[1];
el.onclick=e=>{const b=e.target.closest('[data-a]');if(b&&o.on)try{o.on[b.dataset.a](b.dataset.id)}catch(x){CMS.toast(x.message,false)}}};

CMS.boot=(role,i)=>{CMS.base='../';const u=CMS.user();if(!u||!u.is_active)return location.replace(CMS.base+'index.html');
if(u.role!==role)return location.replace(CMS.base+CMS.home[u.role]);
const m=CMS.mods[role];
const roleIcon = ROLE_ICONS[u.role] || '👤';
document.documentElement.dataset.role = u.role;

document.getElementById('app').innerHTML=`<aside id="sidebar"><div class="sidebar-brand"><div class="logo-icon">🏥</div><h1>Clinic CMS<small>Management System</small></h1></div><nav>${m.map((x,j)=>`<a href="${CMS.slug(x[0])}.html"${j===i?' class="on"':''}><span class="nav-icon">${NAV_ICONS[x[0]]||'📄'}</span>${esc(x[0])}</a>`).join('')}</nav><div class="me"><div class="user-info"><div class="avatar">${initials(u.name)}</div><div class="user-details"><div class="user-name">${esc(u.name)}</div><div class="user-role">${roleIcon} ${esc(u.role.replace('_',' '))}</div></div></div><div class="sidebar-btns"><button class="btn ghost" id="th">☀️ Theme</button><button class="btn ghost" id="lo">🚪 Log out</button></div></div></aside><main id="v"></main>`;

document.getElementById('lo').onclick=CMS.logout;
document.getElementById('th').onclick=()=>{const d=document.documentElement.dataset;d.t=d.t?'':'dark';localStorage.cms_t=d.t;
  document.getElementById('th').textContent=d.t?'🌙 Theme':'☀️ Theme'};
// Set correct theme icon on load
if(document.documentElement.dataset.t==='dark'){document.getElementById('th').textContent='🌙 Theme'}

// Mobile sidebar toggle
const sidebar=document.getElementById('sidebar');
const overlay=document.getElementById('mob-overlay');
const mobToggle=document.getElementById('mob-toggle');
if(mobToggle){
  mobToggle.onclick=()=>{sidebar.classList.toggle('open');overlay.classList.toggle('show')};
  overlay.onclick=()=>{sidebar.classList.remove('open');overlay.classList.remove('show')};
}
// Close sidebar on nav click (mobile)
sidebar.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',()=>{
  if(window.innerWidth<=860){sidebar.classList.remove('open');overlay.classList.remove('show')}
}));

const v=document.getElementById('v');v.style.animation='fadeIn 0.35s ease-out';
m[i][1](v)};
})();
