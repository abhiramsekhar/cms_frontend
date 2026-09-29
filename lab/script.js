/* ClinicCare - Lab Technician Module (frontend demo, data saved in localStorage) */
const $ = id => document.getElementById(id);
const ORDER = {STAT:0, Urgent:1, Normal:2};
const NEXT = {Pending:"🧫 Collect Sample", Collected:"⚙ Start Processing", Processing:"📝 Enter Result", Completed:"📄 View Report"};
let q = "";

function seed() {
  const t = (id,p,n,a,d,test,pr,st,notes,res) => ({id,patient:p,pname:n,age:a,doctor:d,test,sample:CAT[test].s,priority:pr,status:st,notes,date:"28-09-2026",result:res||null});
  const tests = [
    t("LT001","P100","Rahul Nair",34,"D01 - Dr. Anil","CBC","Normal","Pending","Routine check-up."),
    t("LT002","P101","Meera Das",29,"D02 - Dr. Priya","Blood Sugar","Urgent","Processing","Fasting sample. Suspected diabetes."),
    t("LT003","P102","Arun Kumar",45,"D01 - Dr. Anil","Urine Routine","Normal","Completed","Burning sensation while urinating.","LABR001"),
    t("LT004","P103","Sneha Pillai",52,"D03 - Dr. Rajan","Lipid Profile","STAT","Collected","Chest pain follow-up.")
  ];
  return {
    tests,
    results:[{id:"LABR001",test:"LT003",value:6.2,flag:"Normal",remarks:"No abnormality detected.",date:"28-09-2026"}],
    bills:tests.map((x,i)=>({id:"B00"+(i+1),test:x.id,amt:CAT[x.test].p,paid:i==2})),
    notes:[{icon:"🚨",text:"STAT request LT004 (Lipid Profile) needs attention.",time:"09:10",unread:true},
           {icon:"🧪",text:"New request LT001 (CBC) assigned by Dr. Anil.",time:"09:00",unread:true}],
    docNotes:[], n:{t:5,r:2,b:5}
  };
}
function load(){ try { return JSON.parse(localStorage.getItem(KEY)) || seed(); } catch(e){ return seed(); } }
function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e){} }
let S = load(); S.docNotes = S.docNotes || [];

const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const badge = s => `<span class="status ${s.toLowerCase()}">${s}</span>`;
const prio = p => `<span class="prio ${p}">${p}</span>`;
const pad = (p,n) => p + String(n).padStart(3,"0");
const T = id => S.tests.find(x => x.id === id);
const R = id => S.results.find(x => x.id === id);
const who = t => `${esc(t.pname)}<span class="sub">${t.patient} · ${t.age||"-"} yrs</span>`;
const match = t => (t.id+t.patient+t.pname+t.test+t.doctor).toLowerCase().includes(q);
const sorted = () => [...S.tests].sort((a,b) => (ORDER[a.priority]-ORDER[b.priority]) || a.id.localeCompare(b.id));
function notify(text, icon){
  S.notes.unshift({icon:icon||"🔔", text, time:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}), unread:true});
}
const empty = (cols,msg) => `<tr class="empty-row"><td colspan="${cols}">${msg}</td></tr>`;
const actBtn = t => `<button class="small-btn" onclick="quick('${t.id}')">${NEXT[t.status]}</button> <button class="secondary-btn small-sec" onclick="openTest('${t.id}')">Details</button>`;
const statusSel = t => t.status=="Completed" ? badge(t.status) :
  `<select class="stsel ${t.status.toLowerCase()}" onchange="setStatus('${t.id}',this.value)">` +
  ["Pending","Collected","Processing","Completed"].map(x => `<option ${x==t.status?"selected":""}>${x}</option>`).join("") + `</select>`;

/* ---------- Render everything ---------- */
function render(){
  const cnt = s => S.tests.filter(t => t.status===s).length;
  ["Pending","Collected","Processing","Completed"].forEach(s => $("c"+s).textContent = cnt(s));
  const urgent = S.tests.filter(t => t.priority!="Normal" && t.status!="Completed").length;
  $("urgent").innerHTML = urgent ? `<div class="banner">⚠ ${urgent} urgent/STAT test(s) waiting. Handle these first.</div>` : "";

  const rows = sorted().filter(match);
  const queue = rows.filter(t => t.status!="Completed").slice(0,6);
  $("queueBody").innerHTML = queue.map(t => `<tr><td>${t.id}</td><td>${who(t)}</td><td>${t.test}</td><td>${prio(t.priority)}</td><td>${badge(t.status)}</td><td>${actBtn(t)}</td></tr>`).join("") || empty(6,"🎉 No active tests in the queue.");

  const fs=$("fStatus").value, fp=$("fPrio").value;
  const tr = rows.filter(t => (!fs||t.status==fs) && (!fp||t.priority==fp));
  $("testsBody").innerHTML = tr.map(t => `<tr><td>${t.id}</td><td>${who(t)}</td><td>${t.doctor}</td><td>${t.test}</td><td>${t.sample}</td><td>${prio(t.priority)}</td><td>${t.date}</td><td>${statusSel(t)}</td><td>${actBtn(t)}</td></tr>`).join("") || empty(9,"No matching requests found.");

  const reps = S.results.filter(r => match(T(r.test)));
  $("repBody").innerHTML = reps.map(r => { const t=T(r.test); return `<tr><td>${r.id}</td><td>${t.id}</td><td>${who(t)}</td><td>${t.test}</td><td><span class="flag ${r.flag}">${r.value} (${r.flag})</span></td><td>${r.date}</td><td><span class="status completed">✓ ${t.doctor}</span></td><td><button class="small-btn" onclick="viewReport('${r.id}')">View</button> <button class="secondary-btn small-sec" onclick="openPdf(T('${t.id}'),R('${r.id}'))">PDF</button></td></tr>`; }).join("") || empty(8,"No reports yet.");

  const bills = S.bills.filter(b => match(T(b.test)));
  $("billBody").innerHTML = bills.map(b => { const t=T(b.test); return `<tr><td>${b.id}</td><td>${who(t)}</td><td>${t.test}</td><td>₹${b.amt}</td><td>${b.paid?'<span class="status completed">Paid</span>':'<span class="status pending">Unpaid</span>'}</td><td>${b.paid?"—":`<button class="small-btn" onclick="payBill('${b.id}')">Mark Paid</button>`}</td></tr>`; }).join("") || empty(6,"No bills found.");
  const sum = f => S.bills.filter(f).reduce((a,b)=>a+b.amt,0);
  $("billSum").textContent = `Collected ₹${sum(b=>b.paid)} · Outstanding ₹${sum(b=>!b.paid)}`;

  $("noteList").innerHTML = S.notes.map(n => `<div class="notification ${n.unread?"unread":""}"><span>${n.icon}</span><div><strong>${esc(n.text)}</strong><br><small>${n.time}</small></div></div>`).join("");
  $("nCount").textContent = S.notes.filter(n => n.unread).length;

  const open = S.tests.filter(t => t.status=="Processing");
  const cur = $("rTest").value;
  $("rTest").innerHTML = `<option value="">${open.length?"-- Select test in Processing --":"No tests in Processing (start one first)"}</option>` + open.map(t => `<option value="${t.id}">${t.id} · ${esc(t.pname)} · ${t.test}</option>`).join("");
  $("rTest").value = open.some(t=>t.id==cur) ? cur : "";
}

/* ---------- Navigation ---------- */
function showPage(id, btn){
  q=""; $("gs").value="";
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active-page"));
  $(id).classList.add("active-page");
  const b = btn || document.querySelector(`.nav-item[onclick*="'${id}'"]`);
  document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
  if (b) b.classList.add("active");
  $("sidebar").classList.remove("open"); $("overlay").classList.remove("show");
  render(); window.scrollTo({top:0,behavior:"smooth"});
}
function toggleSidebar(){ $("sidebar").classList.toggle("open"); $("overlay").classList.toggle("show", $("sidebar").classList.contains("open")); }
function gsearch(){ q = $("gs").value.toLowerCase().trim(); render(); }
function resetFilters(){ $("fStatus").value=""; $("fPrio").value=""; render(); }
const closeM = id => $(id).classList.remove("show");

/* ---------- Test workflow ---------- */
function openTest(id){
  const t = T(id);
  const d = (k,v) => `<div><strong>${k}</strong><span>${v}</span></div>`;
  $("tDetails").innerHTML = `<div class="detail-grid">${d("Test ID",t.id)}${d("Change Status",statusSel(t))}${d("Patient",esc(t.pname))}${d("Patient ID / Age",t.patient+" · "+(t.age||"-")+" yrs")}${d("Prescribed By",t.doctor)}${d("Priority",prio(t.priority))}${d("Test",t.test)}${d("Sample",t.sample)}<div class="full" style="grid-column:1/-1"><strong>Doctor's Notes</strong><span>${esc(t.notes||"None")}</span></div></div>`;
  $("tActions").innerHTML = `<button class="secondary-btn" onclick="closeM('testModal')">Close</button><button class="primary-btn" onclick="step('${t.id}')">${NEXT[t.status]}</button>`;
  $("testModal").classList.add("show");
}
function setStatus(id, val){
  const t = T(id);
  if (t.status == val) return;
  if (val == "Completed") {
    if (t.status != "Processing") { toast("Move the test to Processing first, then enter the result.", true); render(); if ($("testModal").classList.contains("show")) openTest(id); return; }
    closeM("testModal"); showPage("results"); $("rTest").value = id; fillResult();
    return toast("Enter the result to complete this test");
  }
  t.status = val;
  notify(`${t.id} (${t.pname}) status changed to ${val}.`, "🔄");
  save(); render(); toast(`${t.id} → ${val}`);
  if ($("testModal").classList.contains("show")) openTest(id);
}
function quick(id){
  const t = T(id);
  if (t.status == "Pending") return setStatus(id, "Collected");
  if (t.status == "Collected") return setStatus(id, "Processing");
  if (t.status == "Processing") return setStatus(id, "Completed");
  viewReport(t.result);
}
function step(id){
  const t = T(id);
  if (t.status=="Pending"){ t.status="Collected"; notify(`Sample collected for ${t.id} (${t.pname}).`,"🧫"); toast("Sample collected"); }
  else if (t.status=="Collected"){ t.status="Processing"; notify(`${t.id} (${t.test}) is now processing.`,"🔬"); toast("Processing started"); }
  else if (t.status=="Processing"){ closeM("testModal"); showPage("results"); $("rTest").value=id; fillResult(); return; }
  else { closeM("testModal"); return viewReport(t.result); }
  save(); render(); openTest(id);
}

/* ---------- Results ---------- */
function fillResult(typing){
  const t = T($("rTest").value);
  $("rDate").textContent = today();
  if (!t){ $("rInfo").innerHTML="<span>Select a test to see patient details.</span>"; $("rUnit").textContent=""; $("rFlag").value=""; return; }
  const c = CAT[t.test];
  $("rInfo").innerHTML = `<div><strong>Patient</strong><span>${esc(t.pname)} (${t.patient})</span></div><div><strong>Test</strong><span>${t.test} · ${t.sample}</span></div><div><strong>Normal Range</strong><span>${c.lo} - ${c.hi}</span></div>`;
  $("rUnit").textContent = "in " + c.u;
  const v = parseFloat($("rValue").value);
  $("rFlag").value = isNaN(v) ? "" : flagOf(v,c);
}
const flagOf = (v,c) => v<c.lo ? "Low" : v>c.hi ? "High" : "Normal";
function submitResult(){
  const t = T($("rTest").value), v = parseFloat($("rValue").value);
  $("rTest").classList.toggle("input-error", !t); $("rValue").classList.toggle("input-error", isNaN(v));
  if (!t || isNaN(v)) return toast("Please select a test and enter a valid value.", true);
  const r = {id:pad("LABR",S.n.r++), test:t.id, value:v, flag:flagOf(v,CAT[t.test]), remarks:$("rRemarks").value.trim()||"—", date:today()};
  S.results.push(r); t.status="Completed"; t.result=r.id;
  t.sent = true;
  notify(`Report ${r.id} (${r.flag}) sent to ${t.doctor}.`, r.flag=="Normal"?"✅":"⚠");
  (S.docNotes = S.docNotes || []).unshift({doctor:t.doctor, testId:t.id, unread:true, time:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}), text:`Lab result ${r.id} for ${t.pname} (${t.test}) is ready - ${r.flag}.`});
  save(); $("rValue").value=""; $("rRemarks").value=""; $("rFlag").value="";
  toast(`Result ${r.id} saved and sent to ${t.doctor}`); showPage("reports"); viewReport(r.id);
}

/* ---------- Report ---------- */
function viewReport(rid){
  window.curRid = rid;
  const r = R(rid), t = T(r.test), c = CAT[t.test];
  const d = (k,v) => `<div><strong>${k}</strong><span>${v}</span></div>`;
  $("reportContent").innerHTML = `<div class="report-header"><h2>Laboratory Test Report</h2><p>ClinicCare Laboratory · ${r.date}</p></div><div class="report-grid">${d("Result ID",r.id)}${d("Test ID",t.id)}${d("Patient",esc(t.pname)+" ("+t.patient+")")}${d("Age",(t.age||"-")+" yrs")}${d("Referred By",t.doctor)}${d("Sample",t.sample)}${d("Test",t.test)}${d("Normal Range",c.lo+" - "+c.hi+" "+c.u)}${d("Result",`<span class="flag ${r.flag}">${r.value} — ${r.flag}</span>`)}${d("Remarks",esc(r.remarks))}${d("Performed By","Lab Technician")}</div>`;
  $("reportModal").classList.add("show");
}

/* ---------- New request, billing, notifications ---------- */
function payBill(id){ S.bills.find(b=>b.id==id).paid=true; save(); render(); toast("Payment recorded"); }
function readAll(){ S.notes.forEach(n=>n.unread=false); save(); render(); toast("All notifications marked as read"); }
function resetDemo(){ if(confirm("Reset all demo data?")){ S=seed(); save(); render(); toast("Demo data reset"); } }
function logout(){ if (confirm("Are you sure you want to logout?")) toast("Logged out (connect to Django logout later)"); }

/* ---------- Toast + init ---------- */
let tt;
function toast(m, err){ const e=$("toast"); e.textContent=m; e.classList.toggle("error",!!err); e.classList.add("show"); clearTimeout(tt); tt=setTimeout(()=>e.classList.remove("show"),3200); }
function today(){ return new Date().toLocaleDateString("en-IN"); }
window.onclick = e => { ["testModal","reportModal"].forEach(m => { if (e.target===$(m)) closeM(m); }); };
(function(){
  const h=new Date().getHours();
  $("greeting").textContent = (h<12?"Good Morning":h<17?"Good Afternoon":"Good Evening")+" 👋";
  $("today").textContent = new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
  $("rDate").textContent = today(); render();
})();

/* Live update when the doctor portal (another tab) prescribes a test */
window.addEventListener("storage", function (e) {
  if (e.key === KEY) { S = load(); S.docNotes = S.docNotes || []; render(); toast("🩺 New update from the doctor portal"); }
});