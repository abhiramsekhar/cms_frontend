/* Shared by lab.html and doctor.html */
const KEY = "cliniccare_lab_v2";
const CAT = {
  "CBC":{s:"Blood",lo:13,hi:17,u:"g/dL (Hemoglobin)",p:300},
  "Blood Sugar":{s:"Blood",lo:70,hi:110,u:"mg/dL (Fasting)",p:150},
  "Lipid Profile":{s:"Blood",lo:0,hi:200,u:"mg/dL (Cholesterol)",p:500},
  "Thyroid (TSH)":{s:"Blood",lo:0.4,hi:4,u:"mIU/L",p:450},
  "Urine Routine":{s:"Urine",lo:4.5,hi:8,u:"pH",p:120}
};

/* Builds a real PDF and opens it in a new browser tab (Chrome/Edge/Firefox PDF viewer) */
function openPdf(t, r) {
  if (!t || !r) return;
  if (!window.jspdf) { alert("PDF library could not load. Check your internet connection and try again."); return; }
  const d = new window.jspdf.jsPDF(), c = CAT[t.test];
  let y = 22;
  d.setFontSize(20); d.text("ClinicCare Laboratory", 105, y, {align:"center"}); y += 9;
  d.setFontSize(13); d.text("Laboratory Test Report", 105, y, {align:"center"}); y += 6;
  d.line(15, y, 195, y); y += 12; d.setFontSize(11);
  [["Result ID", r.id], ["Report Date", r.date], ["Patient", t.pname + " (" + t.patient + ")"],
   ["Age", (t.age || "-") + " yrs"], ["Referred By", t.doctor], ["Test", t.test], ["Sample", t.sample],
   ["Normal Range", c.lo + " - " + c.hi + " " + c.u], ["Result", r.value + "  (" + r.flag + ")"],
   ["Remarks", r.remarks], ["Performed By", "Lab Technician"]].forEach(function (row) {
    const lines = d.splitTextToSize(String(row[1]), 120);
    d.setFont(undefined, "bold"); d.text(row[0] + ":", 20, y);
    d.setFont(undefined, "normal"); d.text(lines, 70, y);
    y += lines.length * 6 + 5;
  });
  d.line(15, y + 4, 195, y + 4);
  d.setFontSize(9); d.text("Computer generated report - ClinicCare Hospital Management System", 105, y + 11, {align:"center"});
  const win = window.open(d.output("bloburl"), "_blank");
  if (!win) alert("Please allow pop-ups for this page to open the PDF.");
}