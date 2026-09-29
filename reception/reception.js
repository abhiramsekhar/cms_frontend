/* =========================================================
   RECEPTIONIST FRONTEND  (owner: Receptionist member)
   =========================================================
   FRONT-DESK FLOW  (always the same 3 steps)

     NEW PATIENT       1. Register  ->  2. Book appointment  ->  3. Pay
     EXISTING PATIENT  1. Search (ID / name / phone)
                                    ->  2. Book appointment  ->  3. Pay

   • Patients page  : search box, "+ New Patient", and per-row
                      [Book] [History] [Edit]
   • Booking        : opens as a pop-up (no page hopping), shows only
                      free time slots, then goes straight to payment
   • Billing        : "Collect payment" pop-up -> token is shown
   • Patient history: visits, diagnosis, prescriptions, lab tests, bills

   PAYMENT RULE
     No partial payment. Pending = no token. Full payment = PAID + token.

   CANCELLATION RULE
     • Scheduled appointments can be cancelled even after payment.
     • Paid appointments are NOT refunded.
     • Cancelled appointment keeps its old token internally as
       cancelled_token_number so it can be reused.
     • If the exact same doctor + date + time slot is booked again,
       the released token is reused.
     • If a different slot is booked, the next token is generated.
     • Existing active token numbers are never shifted.

   Only this file is changed for the receptionist screens;
   the shared files (core.js, services.js, theme.css) are NOT modified.
   ========================================================= */
(() => {
'use strict';

const FEES = { registration: 100, consultation: 300 };
const esc = CMS.esc;
const pad2 = n => String(n).padStart(2, '0');

/* ---------------------------------------------------------
   Layout for the NEW pop-ups only (chips, steps, token box...).
   Nothing here changes the existing theme.css look.
   --------------------------------------------------------- */
(() => {
    const s = document.createElement('style');
    s.textContent = `
.rc-chips{display:flex;gap:8px;flex-wrap:wrap;margin:-8px 0 18px}
.rc-chip{border:1px solid var(--line);background:var(--card-solid);color:var(--ink);border-radius:99px;padding:6px 14px;font:600 13px 'Inter',system-ui,sans-serif;cursor:pointer}
.rc-chip b{opacity:.6;font-weight:600;margin-left:4px}
.rc-chip.on{background:var(--acc);border-color:var(--acc);color:#fff}
.rc-acts{display:flex;gap:6px;flex-wrap:nowrap;align-items:center}
.rc-acts .btn.sm{margin:0}
.rc-link{background:none;border:0;padding:0;font:inherit;font-weight:600;color:var(--ink);cursor:pointer;text-align:left}
.rc-link:hover{color:var(--acc);text-decoration:underline}
.rc-sub{display:block;font-size:12px;color:var(--mute);font-weight:400}
.rc-steps{display:flex;gap:8px;align-items:center;margin:8px 0 16px;font-size:12px;font-weight:600;flex-wrap:wrap}
.rc-step{display:inline-flex;align-items:center;gap:6px;color:var(--mute)}
.rc-step i{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;border:1.5px solid currentColor;font-style:normal;font-size:11px}
.rc-step.done{color:var(--good)}
.rc-step.now{color:var(--acc)}
.rc-step.now i{background:var(--acc);border-color:var(--acc);color:#fff}
.rc-step.done i{background:var(--good);border-color:var(--good);color:#fff}
.rc-arrow{color:var(--mute)}
.rc-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
.rc-grid .full{grid-column:1/-1}
.rc-box{border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:0 0 14px;background:var(--acc2)}
.rc-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px 18px;font-size:13px;margin:12px 0}
.rc-facts span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--mute)}
.rc-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:12px 0 16px}
.rc-tiles div{border:1px solid var(--line);border-radius:12px;padding:10px 12px;font-size:12px;color:var(--mute)}
.rc-tiles b{display:block;font-size:18px;color:var(--ink);margin-top:2px}
.rc-visit{border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:10px}
.rc-visit ul{margin:6px 0 0 18px;font-size:13px}
.rc-h{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--mute);margin:16px 0 8px}
.rc-lines{width:100%;border-collapse:collapse;margin:6px 0 14px}
.rc-lines td{padding:7px 4px;border-bottom:1px solid var(--line)}
.rc-lines td:last-child{text-align:right;font-weight:600}
.rc-lines tr.tot td{font-size:16px;font-weight:800;border-bottom:0}
.rc-methods{display:flex;gap:8px;margin:6px 0 14px}
.rc-method{flex:1;display:flex !important;align-items:center;justify-content:center;gap:6px;border:1.5px solid var(--line);border-radius:10px;padding:10px;cursor:pointer;font-weight:600;margin:0 !important}
.rc-method input{width:auto;margin:0}
.rc-method:has(input:checked){border-color:var(--acc);background:var(--acc2);color:var(--acc)}
.rc-token{text-align:center;border:2px dashed var(--acc);border-radius:14px;padding:14px;margin:10px 0}
.rc-token b{display:block;font:800 44px/1.1 'Plus Jakarta Sans',system-ui,sans-serif;color:var(--acc)}
.rc-flow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 0}
.rc-flow>strong{min-width:130px}
@media(max-width:600px){.rc-grid{grid-template-columns:1fr}}
`;
    document.head.appendChild(s);
})();

/* =========================================================
   R = helpers + business rules for the receptionist
   ========================================================= */
const R = {
    /* ---------- data ---------- */
    patients: () => CMS.all('patients'),
    activePatients: () => CMS.all('patients').filter(p => p.is_active),
    doctors: () => CMS.all('users').filter(u => u.role === 'DOCTOR' && u.is_active),
    appointments: () => CMS.all('appointments'),
    bills: () => CMS.all('bills'),
    patient: id => CMS.get('patients', id),
    doctor: id => CMS.get('users', id),
    appointment: id => CMS.get('appointments', id),
    bill: id => CMS.get('bills', id),

    /* ---------- display ---------- */
    money: n => '₹ ' + Number(n || 0).toLocaleString('en-IN'),
    patientName: id => (R.patient(id) || {}).name || 'Unknown patient',
    doctorName: id => (R.doctor(id) || {}).name || 'Unknown doctor',
    medicineName: id => (CMS.get('medicines', id) || {}).name || '—',
    testName: id => (CMS.get('labCatalog', id) || {}).name || '—',
    tokenText: a => (a && a.token_number) ? pad2(a.token_number) : null,
    age: dob => {
        if (!dob) return null;
        const d = new Date(dob), n = new Date();
        let a = n.getFullYear() - d.getFullYear();
        const m = n.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
        return a < 0 ? null : a;
    },
    ageText: dob => {
        const a = R.age(dob);
        return a === null ? '' : a < 1 ? '<1 yr' : a + ' yrs';
    },

    /* ---------- bills (NO partial payment: PENDING or PAID) ---------- */
    billTotal: b => (b && Array.isArray(b.items))
        ? b.items.reduce((t, i) => t + Number(i.amount || 0), 0)
        : 0,

    billDue: b => Math.max(
        0,
        R.billTotal(b) - Number((b && b.paid) || 0)
    ),

    billStatus: b => {
        const t = R.billTotal(b);
        return (t > 0 && Number(b.paid || 0) >= t) ? 'PAID' : 'PENDING';
    },

    registrationBill: pid =>
        R.bills().find(
            b =>
                b.patient === pid &&
                Array.isArray(b.items) &&
                b.items.some(i => i.refType === 'REGISTRATION')
        ),

    appointmentBill: aid =>
        R.bills().find(
            b =>
                Array.isArray(b.items) &&
                b.items.some(
                    i =>
                        i.ref === aid &&
                        (i.refType === 'CONSULTATION' || i.desc === 'Consultation fee')
                )
        ),

    consultItems: b => (b.items || []).filter(i => i.refType === 'CONSULTATION'),

    pendingAmount: pid =>
        R.bills()
            .filter(b => b.patient === pid && R.billStatus(b) === 'PENDING')
            .reduce((t, b) => t + R.billDue(b), 0),

    /* ---------- patient search: ID / name / phone ---------- */
    searchPatients: keyword => {
        const q = String(keyword || '').trim().toLowerCase();

        if (!q) return R.activePatients();

        return R.activePatients().filter(p =>
            String(p.id || '').toLowerCase().includes(q) ||
            String(p.name || '').toLowerCase().includes(q) ||
            String(p.phone || '').includes(q)
        );
    },

    /* ---------- time slots ---------- */
    slotMsg: {
        'time passed': 'That time has already passed.',
        'doctor booked': 'Doctor is already booked at that time.',
        'patient busy': 'This patient already has an appointment at that time.'
    },

    slotState: (doctor, date, slot, patientId, ignoreId) => {
        if (!date) return '';

        const now = new Date().toTimeString().slice(0, 5);

        if (
            date < CMS.today() ||
            (date === CMS.today() && slot <= now)
        ) {
            return 'time passed';
        }

        const live = R.appointments().filter(
            a =>
                a.status === 'SCHEDULED' &&
                a.date === date &&
                a.slot === slot &&
                a.id !== ignoreId
        );

        if (doctor && live.some(a => a.doctor === doctor)) {
            return 'doctor booked';
        }

        if (patientId && live.some(a => a.patient === patientId)) {
            return 'patient busy';
        }

        return '';
    },

    /* ---------- token generation ---------- */
    generateToken: (doctorId, date, ignoreId, slot) => {

        // First check whether this exact doctor + date + slot
        // had a cancelled appointment with a released token.
        if (slot) {
            const released = R.appointments()
                .filter(a =>
                    a.id !== ignoreId &&
                    a.doctor === doctorId &&
                    a.date === date &&
                    a.slot === slot &&
                    a.status === 'CANCELLED' &&
                    a.cancelled_token_number
                )
                .map(a => Number(a.cancelled_token_number))
                .filter(n => n > 0)
                .sort((a, b) => a - b);

            if (released.length) {
                return released[0];
            }
        }

        // If there is no released token for this exact slot,
        // generate the next token for this doctor + date.
        const nums = R.appointments()
            .filter(a =>
                a.id !== ignoreId &&
                a.doctor === doctorId &&
                a.date === date &&
                a.status !== 'CANCELLED' &&
                a.token_number
            )
            .map(a => Number(a.token_number));

        return nums.length ? Math.max(...nums) + 1 : 1;
    },

    /* =====================================================
       BUSINESS RULES (all changes go through CMS.tx)
       ===================================================== */

    bookAppointment: v => {
        let out;

        CMS.tx(() => {
            const p = R.patient(v.patient);
            const d = R.doctor(v.doctor);

            if (!p || !p.is_active) {
                throw Error('Patient is not active');
            }

            if (!d || d.role !== 'DOCTOR' || !d.is_active) {
                throw Error('Doctor is not available');
            }

            if (!v.date || !v.slot) {
                throw Error('Select a date and a time slot');
            }

            const bad = R.slotState(
                v.doctor,
                v.date,
                v.slot,
                v.patient
            );

            if (bad) {
                throw Error(R.slotMsg[bad]);
            }

            const a = CMS.add(
                'appointments',
                {
                    patient: v.patient,
                    doctor: v.doctor,
                    date: v.date,
                    slot: v.slot,
                    status: 'SCHEDULED',
                    token_number: null,
                    payment_status: 'UNPAID'
                },
                'A'
            );

            const item = {
                desc: 'Consultation fee',
                amount: FEES.consultation,
                ref: a.id,
                refType: 'CONSULTATION'
            };

            const reg = R.registrationBill(v.patient);
            let b;

            if (reg && R.billStatus(reg) === 'PENDING') {
                // New patient:
                // registration + consultation on ONE bill.
                b = reg;
                b.items.push(item);
                b.appointment = a.id;
                b.payment_status = 'PENDING';
            } else {
                b = CMS.add(
                    'bills',
                    {
                        patient: v.patient,
                        appointment: a.id,
                        items: [item],
                        paid: 0,
                        payment_method: '',
                        date: CMS.today(),
                        payment_status: 'PENDING'
                    },
                    'B'
                );
            }

            out = {
                appointment: a,
                bill: b
            };
        });

        return out;
    },

    updateAppointment: (id, v) => CMS.tx(() => {
        const a = R.appointment(id);

        if (!a) {
            throw Error('Appointment not found');
        }

        if (a.status !== 'SCHEDULED') {
            throw Error('Only scheduled appointments can be edited');
        }

        const d = R.doctor(v.doctor);

        if (!d || d.role !== 'DOCTOR' || !d.is_active) {
            throw Error('Doctor is not available');
        }

        const bad = R.slotState(
            v.doctor,
            v.date,
            v.slot,
            a.patient,
            a.id
        );

        if (bad) {
            throw Error(R.slotMsg[bad]);
        }

        const moved =
            v.doctor !== a.doctor ||
            v.date !== a.date;

        Object.assign(a, {
            doctor: v.doctor,
            date: v.date,
            slot: v.slot
        });

        if (moved) {
            // Token belongs to doctor + day,
            // so it must be re-issued.
            a.token_number = null;
            a.token_generated = false;

            if (a.payment_status === 'PAID') {
                a.token_number = R.generateToken(
                    a.doctor,
                    a.date,
                    a.id,
                    a.slot
                );

                a.cancelled_token_number = null;
                a.token_generated = true;
            }
        }

        return a;
    }),

    /* ---------- cancellation ---------- */
    cancelAppointment: id => CMS.tx(() => {
        const a = R.appointment(id);

        if (!a) {
            throw Error('Appointment not found');
        }

        if (a.status !== 'SCHEDULED') {
            throw Error('Only scheduled appointments can be cancelled');
        }

        const b = R.appointmentBill(id);

        // Save old token before cancelling.
        // This token can be reused if the same slot is booked again.
        if (a.token_number) {
            a.cancelled_token_number = Number(a.token_number);
        } else {
            a.cancelled_token_number = null;
        }

        // NO REFUND.
        // If payment has already been made,
        // keep the bill and payment record.
        if (b && Number(b.paid || 0) <= 0) {

            // Unpaid appointment:
            // remove only this appointment's consultation charge.
            b.items = b.items.filter(i => i.ref !== id);

            // If nothing remains on the bill,
            // remove the empty bill.
            if (!b.items.length) {
                const list = R.bills();
                const index = list.indexOf(b);

                if (index >= 0) {
                    list.splice(index, 1);
                }
            }
        }

        // Cancel appointment.
        a.status = 'CANCELLED';

        // Token is no longer active.
        a.token_number = null;

        // Payment status becomes CANCELLED.
        a.payment_status = 'CANCELLED';
    }),

    /* ---------- complete payment ---------- */
    completePayment: (billId, method) => {
        let out;

        CMS.tx(() => {
            const b = R.bill(billId);

            if (!b) {
                throw Error('Bill not found');
            }

            if (R.billTotal(b) <= 0) {
                throw Error('This bill has nothing to pay');
            }

            if (R.billDue(b) <= 0) {
                throw Error('This bill is already paid');
            }

            if (!['CASH', 'CARD', 'UPI'].includes(method)) {
                throw Error('Select a valid payment method');
            }

            b.paid = R.billTotal(b);
            b.payment_method = method;
            b.last_payment_date = CMS.today();
            b.payment_status = 'PAID';

            const ids = [];

            R.consultItems(b).forEach(item => {
                const a = R.appointment(item.ref);

                if (!a) return;

                a.payment_status = 'PAID';

                if (a.status === 'SCHEDULED' && !a.token_number) {

                    const token = R.generateToken(
                        a.doctor,
                        a.date,
                        a.id,
                        a.slot
                    );

                    a.token_number = token;

                    // The new appointment now owns this token.
                    a.cancelled_token_number = null;
                    a.token_generated = true;

                    // Consume old released-token markers for this
                    // exact doctor + date + slot + token so the same
                    // cancelled token is not treated as released again.
                    R.appointments()
                        .filter(old =>
                            old.id !== a.id &&
                            old.doctor === a.doctor &&
                            old.date === a.date &&
                            old.slot === a.slot &&
                            old.status === 'CANCELLED' &&
                            Number(old.cancelled_token_number) === Number(token)
                        )
                        .forEach(old => {
                            old.cancelled_token_number = null;
                        });
                }

                ids.push(a.id);
            });

            out = {
                bill: b,
                ids
            };
        });

        return {
            bill: out.bill,
            appointments: out.ids.map(R.appointment)
        };
    },

    /* =====================================================
       UI PIECES
       ===================================================== */

    steps: now =>
        ['Patient', 'Appointment', 'Payment & token']
            .map((l, i) =>
                `<span class="rc-step ${i < now ? 'done' : i === now ? 'now' : ''}">
                    <i>${i < now ? '✓' : i + 1}</i>${l}
                </span>`
            )
            .join('<span class="rc-arrow">›</span>'),

    dialog: (html, width = 480) => {
        const m = document.createElement('div');
        m.className = 'modal';

        m.innerHTML =
            `<form class="card" novalidate style="width:min(${width}px,100%);max-height:92vh;overflow:auto">${html}</form>`;

        const form = m.firstElementChild;
        const close = () => m.remove();

        form.querySelectorAll('[data-x]').forEach(
            b => b.onclick = close
        );

        document.body.append(m);

        return {
            m,
            form,
            close
        };
    },

    setErr: (form, name, msg) => {
        form.elements[name]
            .closest('label')
            .querySelector('.err')
            .textContent = msg || '';

        return msg ? 1 : 0;
    },

    /* ---------- register / edit patient ---------- */
    patientForm: (patient, onDone, prefill = {}) => {
        const V = CMS.V;
        const isNew = !patient;
        const p = patient || prefill;
        const num = 'inputmode="numeric" maxlength="10"';

        const fields = [
            { n: 'name', l: 'Full name', v: V.name },
            { n: 'phone', l: 'Phone', v: V.phone, a: num },
            { n: 'dob', l: 'Date of birth', t: 'date', v: V.dob, a: `max="${CMS.today()}"` },
            { n: 'gender', l: 'Gender', t: 'select', o: ['Female', 'Male', 'Other'] },
            { n: 'blood', l: 'Blood group', t: 'select', o: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
            { n: 'emergency', l: 'Emergency contact phone', v: [V.phone, V.notPhone], a: num },
            { n: 'email', l: 'Email', t: 'email', opt: 1, v: V.email, full: 1 },
            { n: 'address', l: 'Address', t: 'textarea', full: 1 },
            { n: 'allergies', l: 'Allergies', t: 'textarea', opt: 1, full: 1 }
        ];

        const control = f => {
            const val = esc(p[f.n] || '');

            if (f.t === 'select') {
                return `<select name="${f.n}">
                    <option value="">Select…</option>
                    ${f.o.map(o =>
                        `<option ${p[f.n] === o ? 'selected' : ''}>${o}</option>`
                    ).join('')}
                </select>`;
            }

            if (f.t === 'textarea') {
                return `<textarea name="${f.n}" rows="2">${val}</textarea>`;
            }

            return `<input name="${f.n}" type="${f.t || 'text'}" value="${val}" ${f.a || ''}>`;
        };

        const { form, close } = R.dialog(`
            <h3>${isNew ? 'Register New Patient' : 'Edit Patient Details'}</h3>

            ${isNew
                ? `<div class="rc-steps">
                    <span class="rc-step now"><i>1</i>Patient</span>
                    <span class="rc-arrow">›</span>
                    <span class="rc-step"><i>2</i>Appointment</span>
                    <span class="rc-arrow">›</span>
                    <span class="rc-step"><i>3</i>Payment &amp; token</span>
                  </div>`
                : `<p class="text-mute fs-sm">
                    Patient ID: <strong>${esc(patient.id)}</strong>
                  </p><br>`
            }

            <div class="rc-grid">
                ${fields.map(f =>
                    `<label class="${f.full ? 'full' : ''}">
                        ${f.l}${f.opt ? '' : ' *'}
                        ${control(f)}
                        <small class="err"></small>
                    </label>`
                ).join('')}
            </div>

            <div class="row">
                <button type="button" class="btn ghost" data-x>Cancel</button>
                <button class="btn">${isNew ? 'Register & book appointment' : 'Save changes'}</button>
            </div>
        `, 640);

        form.onsubmit = ev => {
            ev.preventDefault();

            const v = {};
            let bad = 0;

            fields.forEach(
                f => v[f.n] = form.elements[f.n].value.trim()
            );

            fields.forEach(f => {
                const x = v[f.n];

                const er = !x
                    ? (f.opt ? '' : 'Required')
                    : ([].concat(f.v || [])
                        .map(g => g(x, v))
                        .find(Boolean) || '');

                bad += R.setErr(
                    form,
                    f.n,
                    er
                );
            });

            if (bad) return;

            const dup = R.patients().find(
                q =>
                    q.is_active &&
                    q.phone === v.phone &&
                    (!patient || q.id !== patient.id)
            );

            if (dup) {
                R.setErr(
                    form,
                    'phone',
                    `Already registered: ${dup.id} — ${dup.name}. Search this patient and book from the list.`
                );
                return;
            }

            try {
                let saved;

                CMS.tx(() => {
                    if (patient) {
                        Object.assign(patient, v);
                        saved = patient;
                        return;
                    }

                    saved = CMS.add(
                        'patients',
                        {
                            ...v,
                            registered: CMS.today(),
                            is_active: true
                        },
                        'P'
                    );

                    CMS.add(
                        'bills',
                        {
                            patient: saved.id,
                            items: [
                                {
                                    desc: 'Registration fee',
                                    amount: FEES.registration,
                                    ref: saved.id,
                                    refType: 'REGISTRATION'
                                }
                            ],
                            paid: 0,
                            payment_method: '',
                            date: CMS.today(),
                            payment_status: 'PENDING'
                        },
                        'B'
                    );
                });

                close();

                CMS.toast(
                    isNew
                        ? `Patient ${saved.id} registered`
                        : `Patient ${saved.id} updated`
                );

                onDone && onDone(saved);

            } catch (err) {
                CMS.toast(err.message, false);
            }
        };

        form.elements.name.focus();
    },

    /* ---------- wire doctor + date -> only free slots ---------- */
    bindSlots: (form, patientId, ignoreId) => {
        const refresh = () => {
            const keep = form.elements.slot.value;

            form.elements.slot.innerHTML =
                '<option value="">Select…</option>' +
                CMS.S.slots.map(s => {
                    const st = R.slotState(
                        form.elements.doctor.value,
                        form.elements.date.value,
                        s,
                        patientId,
                        ignoreId
                    );

                    return `<option value="${s}" ${st ? 'disabled' : ''}>
                        ${s}${st ? ' — ' + st : ''}
                    </option>`;
                }).join('');

            const opt = [
                ...form.elements.slot.options
            ].find(
                o => o.value === keep && !o.disabled
            );

            if (opt) {
                form.elements.slot.value = keep;
            }
        };

        form.elements.doctor.onchange =
            form.elements.date.onchange =
            form.elements.date.oninput =
                refresh;

        refresh();
    },

    doctorOptions: sel =>
        R.doctors()
            .map(d =>
                `<option value="${esc(d.id)}" ${d.id === sel ? 'selected' : ''}>
                    ${esc(d.name)}
                </option>`
            )
            .join(''),

    /* ---------- book appointment (pop-up) ---------- */
    openBooking: (patient, opts = {}) => {
        const doctors = R.doctors();

        if (!doctors.length) {
            CMS.toast('No active doctors available.', false);
            return;
        }

        const reg = R.registrationBill(patient.id);

        const regDue =
            (reg && R.billStatus(reg) === 'PENDING')
                ? R.billDue(reg)
                : 0;

        const age = R.ageText(patient.dob);

        const { form, close } = R.dialog(`
            <h3>Book Appointment</h3>

            <div class="rc-steps">${R.steps(1)}</div>

            <div class="rc-box">
                <strong>${esc(patient.name)}</strong>
                <span class="text-mute fs-sm">
                    ${esc(patient.id)} ·
                    ${esc(patient.phone)}
                    ${age ? ' · ' + age : ''}
                    ${patient.gender ? ' · ' + esc(patient.gender) : ''}
                </span>

                ${patient.allergies
                    ? `<div class="text-warn fs-sm">
                        ⚠️ Allergies: ${esc(patient.allergies)}
                       </div>`
                    : ''
                }
            </div>

            <label>
                Doctor *
                <select name="doctor">
                    ${doctors.length > 1 ? '<option value="">Select…</option>' : ''}
                    ${R.doctorOptions(doctors.length === 1 ? doctors[0].id : '')}
                </select>
                <small class="err"></small>
            </label>

            <label>
                Date *
                <input name="date" type="date" min="${CMS.today()}" value="${CMS.today()}">
                <small class="err"></small>
            </label>

            <label>
                Time slot *
                <select name="slot"></select>
                <small class="err"></small>
            </label>

            <p class="text-mute fs-sm">
                Bill: Consultation ${R.money(FEES.consultation)}
                ${regDue ? ` + Registration ${R.money(regDue)} (unpaid)` : ''}
                = <strong>${R.money(FEES.consultation + regDue)}</strong>.
                Token is issued after full payment.
            </p>

            <div class="row">
                <button type="button" class="btn ghost" data-x>Cancel</button>
                <button type="button" class="btn ghost" data-later>Book, pay later</button>
                <button class="btn">Book &amp; collect payment</button>
            </div>
        `);

        R.bindSlots(
            form,
            patient.id,
            null
        );

        form.querySelector('[data-x]').onclick = () => {
            close();
            opts.onCancel && opts.onCancel();
        };

        const submit = later => {
            const v = {
                patient: patient.id,
                doctor: form.elements.doctor.value,
                date: form.elements.date.value,
                slot: form.elements.slot.value
            };

            let bad = 0;

            bad += R.setErr(
                form,
                'doctor',
                v.doctor ? '' : 'Required'
            );

            bad += R.setErr(
                form,
                'date',
                !v.date
                    ? 'Required'
                    : v.date < CMS.today()
                        ? 'Pick today or a later date'
                        : ''
            );

            bad += R.setErr(
                form,
                'slot',
                v.slot ? '' : 'Choose a free time slot'
            );

            if (bad) return;

            try {
                const res = R.bookAppointment(v);

                close();

                if (later) {
                    CMS.toast(
                        `Appointment ${res.appointment.id} booked. Payment is pending.`
                    );

                    opts.onBooked && opts.onBooked(res, true);

                } else {
                    sessionStorage.setItem(
                        'reception_pay_bill',
                        res.bill.id
                    );

                    CMS.toast(
                        `Appointment ${res.appointment.id} booked. Opening payment…`
                    );

                    setTimeout(
                        () => {
                            location.href = 'billing.html';
                        },
                        350
                    );
                }

            } catch (err) {
                CMS.toast(err.message, false);
                R.bindSlots(
                    form,
                    patient.id,
                    null
                );
            }
        };

        form.onsubmit = ev => {
            ev.preventDefault();
            submit(false);
        };

        form.querySelector('[data-later]').onclick =
            () => submit(true);
    },

    /* ---------- edit appointment ---------- */
    openEditAppointment: (a, done) => {
        const p = R.patient(a.patient);

        const { form, close } = R.dialog(`
            <h3>Edit Appointment ${esc(a.id)}</h3>

            <p class="text-mute fs-sm">
                Patient
                <strong>${esc(p ? p.name : 'Unknown')}</strong>
                (${esc(a.patient)})
            </p><br>

            <label>
                Doctor *
                <select name="doctor">
                    ${R.doctorOptions(a.doctor)}
                </select>
                <small class="err"></small>
            </label>

            <label>
                Date *
                <input name="date" type="date" min="${CMS.today()}" value="${esc(a.date)}">
                <small class="err"></small>
            </label>

            <label>
                Time slot *
                <select name="slot"></select>
                <small class="err"></small>
            </label>

            ${a.payment_status === 'PAID'
                ? '<p class="text-mute fs-sm">Fee is paid. If you change doctor or date, a new token is issued for that day.</p>'
                : ''
            }

            <div class="row">
                <button type="button" class="btn ghost" data-x>Cancel</button>
                <button class="btn">Save changes</button>
            </div>
        `);

        R.bindSlots(
            form,
            a.patient,
            a.id
        );

        form.elements.slot.value = a.slot;

        form.onsubmit = ev => {
            ev.preventDefault();

            const v = {
                doctor: form.elements.doctor.value,
                date: form.elements.date.value,
                slot: form.elements.slot.value
            };

            let bad = 0;

            bad += R.setErr(
                form,
                'doctor',
                v.doctor ? '' : 'Required'
            );

            bad += R.setErr(
                form,
                'date',
                v.date ? '' : 'Required'
            );

            bad += R.setErr(
                form,
                'slot',
                v.slot ? '' : 'Choose a free time slot'
            );

            if (bad) return;

            try {
                const u = R.updateAppointment(
                    a.id,
                    v
                );

                close();

                CMS.toast(
                    u.token_number && u.payment_status === 'PAID'
                        ? `Appointment updated. Token ${pad2(u.token_number)}.`
                        : 'Appointment updated'
                );

                done && done();

            } catch (err) {
                CMS.toast(err.message, false);
            }
        };
    },

    /* ---------- find a patient, then act on them ---------- */
    openPatientPicker: (title, onBook) => {
        const { m, form, close } = R.dialog(`
            <h3>${esc(title)}</h3>

            <p class="text-mute fs-sm">
                Search by Patient ID, name or phone number.
            </p><br>

            <input
                name="q"
                placeholder="e.g. P0003, Meera, 9876543210"
                autocomplete="off"
            >

            <div id="rc-pick" style="margin-top:14px"></div>

            <div class="row">
                <button type="button" class="btn ghost" data-x>Close</button>
            </div>
        `, 620);

        const out = m.querySelector('#rc-pick');

        const show = () => {
            const all = R.searchPatients(
                form.elements.q.value
            );

            const list = all.slice(0, 8);

            out.innerHTML = list.length
                ? list.map(p => `
                    <div
                        class="rc-visit"
                        style="display:flex;justify-content:space-between;align-items:center;gap:12px"
                    >
                        <div>
                            <strong>${esc(p.name)}</strong>
                            <span class="rc-sub">
                                ${esc(p.id)} ·
                                ${esc(p.phone)} ·
                                ${esc(R.ageText(p.dob))}
                                ${esc(p.gender || '')}
                            </span>
                        </div>

                        <div class="rc-acts">
                            <button
                                type="button"
                                class="btn sm"
                                data-book="${esc(p.id)}"
                            >
                                📅 Book
                            </button>

                            <button
                                type="button"
                                class="btn sm ghost"
                                data-hist="${esc(p.id)}"
                            >
                                📜 History
                            </button>
                        </div>
                    </div>`
                ).join('') +
                (all.length > list.length
                    ? `<p class="text-mute fs-sm">
                        Showing ${list.length} of ${all.length} —
                        type more to narrow down.
                       </p>`
                    : '')
                : `<div class="empty">
                    No patient found.<br><br>
                    <a class="btn sm" href="patients.html?new=1">
                        + Register as new patient
                    </a>
                   </div>`;
        };

        form.elements.q.oninput = show;

        out.onclick = ev => {
            const b = ev.target.closest(
                '[data-book],[data-hist]'
            );

            if (!b) return;

            const p = R.patient(
                b.dataset.book || b.dataset.hist
            );

            if (!p) {
                return CMS.toast(
                    'Patient not found',
                    false
                );
            }

            if (b.dataset.book) {
                close();
                onBook(p);
            } else {
                R.openHistory(p, {});
            }
        };

        form.onsubmit = ev =>
            ev.preventDefault();

        show();

        form.elements.q.focus();
    },

    /* ---------- patient history ---------- */
    openHistory: (p, opts = {}) => {
        const visits = R.appointments()
            .filter(a => a.patient === p.id)
            .sort(
                (a, b) =>
                    (b.date + b.slot)
                        .localeCompare(a.date + a.slot)
            );

        const rx = CMS.all('prescriptions')
            .filter(r => r.patient === p.id);

        const labs = CMS.all('labOrders')
            .filter(o => o.patient === p.id);

        const bills = R.bills()
            .filter(b => b.patient === p.id)
            .slice()
            .reverse();

        const real = visits.filter(
            a => a.status !== 'CANCELLED'
        );

        const done = visits.filter(
            a => a.status === 'COMPLETED'
        );

        const billed = bills.reduce(
            (t, b) => t + R.billTotal(b),
            0
        );

        const due = R.pendingAmount(p.id);

        const fact = (k, v) =>
            `<div>
                <span>${k}</span>
                ${v || '<span style="text-transform:none;letter-spacing:0">—</span>'}
            </div>`;

        const visitHtml = a => {
            const mine = rx.filter(
                r => r.appt === a.id
            );

            const tests = labs.filter(
                o => o.appt === a.id
            );

            const bill = R.appointmentBill(a.id);

            const cancelledToken =
                a.status === 'CANCELLED' && a.cancelled_token_number
                    ? ` · Released token <strong>${pad2(a.cancelled_token_number)}</strong>`
                    : '';

            const activeToken =
                R.tokenText(a)
                    ? ` · Token <strong>${R.tokenText(a)}</strong>`
                    : '';

            return `
                <div class="rc-visit">
                    <div
                        style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"
                    >
                        <div>
                            <strong>${esc(a.date)}</strong>
                            <span class="text-acc fw-600">${esc(a.slot)}</span>
                            · ${esc(R.doctorName(a.doctor))}
                            ${activeToken}
                            ${cancelledToken}
                        </div>

                        <div>
                            ${CMS.badge(a.status)}
                            ${
                                a.status !== 'CANCELLED'
                                    ? CMS.badge(
                                        bill
                                            ? R.billStatus(bill)
                                            : 'PENDING'
                                      )
                                    : ''
                            }
                        </div>
                    </div>

                    ${
                        a.diagnosis
                            ? `<div
                                class="fs-sm"
                                style="margin-top:6px"
                              >
                                <strong>Diagnosis:</strong>
                                ${esc(a.diagnosis)}
                                ${
                                    a.notes
                                        ? ` <span class="text-mute">— ${esc(a.notes)}</span>`
                                        : ''
                                }
                               </div>`
                            : ''
                    }

                    ${
                        mine.length
                            ? `<ul>
                                ${mine.map(r =>
                                    `<li>
                                        💊
                                        ${esc(R.medicineName(r.medicine))}
                                        × ${esc(r.qty)}
                                        — ${esc(r.dosage)}
                                        ${CMS.badge(r.status)}
                                     </li>`
                                ).join('')}
                               </ul>`
                            : ''
                    }

                    ${
                        tests.length
                            ? `<ul>
                                ${tests.map(o =>
                                    `<li>
                                        🧪
                                        ${esc(R.testName(o.test))}
                                        ${
                                            o.result
                                                ? ' — ' +
                                                  esc(o.result) +
                                                  (
                                                      o.flag
                                                          ? ` (${esc(o.flag)})`
                                                          : ''
                                                  )
                                                : ''
                                        }
                                        ${CMS.badge(o.status)}
                                     </li>`
                                ).join('')}
                               </ul>`
                            : ''
                    }
                </div>`;
        };

        const { form, close } = R.dialog(`
            <h3>
                ${esc(p.name)}
                <span class="badge">${esc(p.id)}</span>
            </h3>

            <p class="text-mute fs-sm">
                Patient history
            </p>

            <div class="rc-facts">
                ${fact('Phone', esc(p.phone))}
                ${fact(
                    'Date of birth',
                    p.dob
                        ? `${esc(p.dob)} (${esc(R.ageText(p.dob))})`
                        : ''
                )}
                ${fact('Gender', esc(p.gender))}
                ${fact('Blood group', esc(p.blood))}
                ${fact('Emergency contact', esc(p.emergency))}
                ${fact('Registered', esc(p.registered))}
                ${fact('Email', esc(p.email))}
                ${fact('Address', esc(p.address))}
            </div>

            ${
                p.allergies
                    ? `<div class="rc-box text-warn fw-600">
                        ⚠️ Allergies: ${esc(p.allergies)}
                       </div>`
                    : ''
            }

            <div class="rc-tiles">
                <div>
                    Visits
                    <b>${real.length}</b>
                </div>

                <div>
                    Completed
                    <b>${done.length}</b>
                </div>

                <div>
                    Total billed
                    <b>${R.money(billed)}</b>
                </div>

                <div>
                    Pending
                    <b class="${due ? 'text-bad' : 'text-good'}">
                        ${R.money(due)}
                    </b>
                </div>
            </div>

            <div class="rc-h">Visits</div>

            ${
                visits.length
                    ? visits.map(visitHtml).join('')
                    : '<p class="text-mute fs-sm">No appointments yet.</p>'
            }

            <div class="rc-h">Bills</div>

            ${
                bills.length
                    ? `<div class="scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>Bill</th>
                                    <th>Charges</th>
                                    <th>Total</th>
                                    <th>Status</th>
                                </tr>
                            </thead>

                            <tbody>
                                ${bills.map(b =>
                                    `<tr>
                                        <td>${esc(b.id)}</td>
                                        <td>
                                            ${(b.items || [])
                                                .map(i => esc(i.desc))
                                                .join(', ')}
                                        </td>
                                        <td>${R.money(R.billTotal(b))}</td>
                                        <td>${CMS.badge(R.billStatus(b))}</td>
                                     </tr>`
                                ).join('')}
                            </tbody>
                        </table>
                       </div>`
                    : '<p class="text-mute fs-sm">No bills yet.</p>'
            }

            <div
                class="row"
                style="margin-top:16px"
            >
                <button
                    type="button"
                    class="btn ghost"
                    data-x
                >
                    Close
                </button>

                <button
                    type="button"
                    class="btn ghost"
                    data-edit
                >
                    ✏️ Edit details
                </button>

                <button
                    type="button"
                    class="btn"
                    data-book
                >
                    📅 Book appointment
                </button>
            </div>
        `, 760);

        form.onsubmit = ev =>
            ev.preventDefault();

        form.querySelector('[data-edit]').onclick = () => {
            close();

            R.patientForm(
                R.patient(p.id),
                () => {
                    opts.onChange && opts.onChange();
                }
            );
        };

        form.querySelector('[data-book]').onclick = () => {
            close();

            R.openBooking(
                R.patient(p.id),
                {
                    onBooked: opts.onChange
                }
            );
        };
    },

    /* ---------- collect payment ---------- */
    openPayment: (bill, done) => {
        const p = R.patient(bill.patient);
        const due = R.billDue(bill);

        const { form, close } = R.dialog(`
            <h3>Collect Payment</h3>

            <div class="rc-steps">
                ${R.steps(2)}
            </div>

            <p class="fs-sm">
                <strong>${esc(p ? p.name : 'Unknown')}</strong>
                <span class="text-mute">
                    ${esc(bill.patient)} · Bill ${esc(bill.id)}
                </span>
            </p>

            <table class="rc-lines">
                ${(bill.items || []).map(i =>
                    `<tr>
                        <td>${esc(i.desc)}</td>
                        <td>${R.money(i.amount)}</td>
                     </tr>`
                ).join('')}

                <tr class="tot">
                    <td>Total to pay</td>
                    <td>${R.money(due)}</td>
                </tr>
            </table>

            <div class="fs-sm fw-600">
                Payment method
            </div>

            <div class="rc-methods">
                ${
                    [
                        ['CASH', '💵 Cash'],
                        ['CARD', '💳 Card'],
                        ['UPI', '📱 UPI']
                    ].map((m, i) =>
                        `<label class="rc-method">
                            <input
                                type="radio"
                                name="method"
                                value="${m[0]}"
                                ${i ? '' : 'checked'}
                            >
                            ${m[1]}
                        </label>`
                    ).join('')
                }
            </div>

            <p class="text-mute fs-sm">
                Full payment only. The token is generated when payment is confirmed.
            </p>

            <div class="row">
                <button
                    type="button"
                    class="btn ghost"
                    data-x
                >
                    Cancel
                </button>

                <button class="btn">
                    Confirm ${R.money(due)} received
                </button>
            </div>
        `);

        form.onsubmit = ev => {
            ev.preventDefault();

            try {
                const res = R.completePayment(
                    bill.id,
                    form.elements.method.value
                );

                close();

                R.openReceipt(
                    res,
                    done
                );

            } catch (err) {
                CMS.toast(
                    err.message,
                    false
                );
            }
        };
    },

    openReceipt: (res, done) => {
        const tokens = res.appointments.filter(
            a => R.tokenText(a)
        );

        const { form, close } = R.dialog(`
            <h3>✅ Payment received</h3>

            <p class="text-mute fs-sm">
                ${R.money(R.billTotal(res.bill))}
                via ${esc(res.bill.payment_method)}
                · Bill ${esc(res.bill.id)}
            </p>

            ${
                tokens.length
                    ? tokens.map(a =>
                        `<div class="rc-token">
                            Token
                            <b>${R.tokenText(a)}</b>
                            <div class="fs-sm">
                                ${esc(R.patientName(a.patient))}
                                ·
                                ${esc(R.doctorName(a.doctor))}
                                <br>
                                ${esc(a.date)}
                                at
                                ${esc(a.slot)}
                            </div>
                         </div>`
                    ).join('')
                    : '<p class="fs-sm">No appointment token for this bill.</p>'
            }

            <div class="row">
                <button
                    type="button"
                    class="btn"
                    data-x
                >
                    Done
                </button>
            </div>
        `);

        form.onsubmit = ev =>
            ev.preventDefault();

        form.querySelector('[data-x]').onclick = () => {
            close();
            done && done();
        };
    },

    /* ---------- page helpers ---------- */
    head: (title, sub, tools) =>
        `<div class="head">
            <div style="display:block">
                <h2>${title}</h2>
                ${sub ? `<p class="text-mute fs-sm">${sub}</p>` : ''}
            </div>

            <div class="rc-tools">
                ${tools || ''}
            </div>
        </div>`,

    table: (cols, rows, empty) =>
        `<div class="card scroll">
            <table>
                <thead>
                    <tr>
                        ${cols.map(c => `<th>${esc(c[0])}</th>`).join('')}
                    </tr>
                </thead>

                <tbody>
                    ${
                        rows.length
                            ? rows.map(r =>
                                `<tr>
                                    ${cols.map(c => `<td>${c[1](r)}</td>`).join('')}
                                 </tr>`
                            ).join('')
                            : `<tr>
                                <td
                                    colspan="${cols.length}"
                                    class="empty"
                                >
                                    ${empty}
                                </td>
                               </tr>`
                    }
                </tbody>
            </table>
        </div>`,

    chips: (list, cur) =>
        `<div class="rc-chips">
            ${list.map(c =>
                `<button
                    class="rc-chip ${c[0] === cur ? 'on' : ''}"
                    data-chip="${c[0]}"
                >
                    ${esc(c[1])}
                    <b>${c[2]}</b>
                </button>`
            ).join('')}
        </div>`,

    onClicks: (el, handlers) => {
        el.onclick = ev => {
            const b = ev.target.closest('[data-a]');

            if (!b || !handlers[b.dataset.a]) return;

            try {
                handlers[b.dataset.a](
                    b.dataset.id,
                    b
                );
            } catch (err) {
                CMS.toast(
                    err.message,
                    false
                );
            }
        };
    },

    payNow: billId => {
        sessionStorage.setItem(
            'reception_pay_bill',
            billId
        );

        location.href = 'billing.html';
    }
};

CMS.reception = R;   // handy for debugging in the console

/* =========================================================
   RECEPTIONIST SCREENS   (order = sidebar order)
   ========================================================= */
CMS.mods.RECEPTIONIST = [

/* ---------------------------------------------------------
   0. DASHBOARD
   --------------------------------------------------------- */
['Dashboard', el => {
    const today = CMS.today();
    const me = CMS.user();

    const todays = R.appointments()
        .filter(
            a =>
                a.date === today &&
                a.status !== 'CANCELLED'
        )
        .sort(
            (a, b) =>
                (a.token_number && b.token_number)
                    ? a.token_number - b.token_number
                    : String(a.slot).localeCompare(String(b.slot))
        );

    const newToday =
        R.patients()
            .filter(p => p.registered === today)
            .length;

    const collected =
        R.bills()
            .filter(b => b.last_payment_date === today)
            .reduce(
                (t, b) => t + Number(b.paid || 0),
                0
            );

    const pending =
        R.bills()
            .filter(
                b =>
                    R.billStatus(b) === 'PENDING' &&
                    R.billTotal(b) > 0
            )
            .length;

    const card = (label, val) =>
        `<div class="card" style="padding:20px">
            <div class="text-mute fs-sm">${label}</div>
            <div
                style="font-size:30px;font-weight:800;margin-top:8px"
            >
                ${val}
            </div>
        </div>`;

    const flow = (title, first, btn) =>
        `<div class="rc-flow">
            <strong>${title}</strong>

            <span class="rc-step">
                <i>1</i>${first}
            </span>

            <span class="rc-arrow">›</span>

            <span class="rc-step">
                <i>2</i>Book appointment
            </span>

            <span class="rc-arrow">›</span>

            <span class="rc-step">
                <i>3</i>Pay &amp; get token
            </span>

            ${btn}
        </div>`;

    el.innerHTML =
        R.head(
            'Receptionist Dashboard',
            `Welcome, ${esc(me ? me.name : '')} · ${esc(today)}`
        ) +
        `
        <div
            style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px"
        >
            ${card('👥 New patients today', newToday)}
            ${card('📅 Today\'s appointments', todays.length)}
            ${card('💰 Today\'s collection', R.money(collected))}
            ${card('⏳ Pending payments', pending)}
        </div>

        <div
            class="card"
            style="padding:20px;margin-bottom:24px"
        >
            <h3 style="margin-top:0">
                FRONT DESK
            </h3>

            ${flow(
                'New patient',
                'Register',
                '<a class="btn sm" href="patients.html?new=1" style="margin-left:auto">+ New patient</a>'
            )}

            ${flow(
                'Existing patient',
                'Search',
                '<a class="btn sm ghost" href="patients.html?find=1" style="margin-left:auto">🔍 Find patient</a>'
            )}

            <div
                style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px"
            >
                <a
                    class="btn ghost"
                    href="billing.html"
                >
                    💳 Collect payments (${pending})
                </a>

                <a
                    class="btn ghost"
                    href="appointments.html"
                >
                    📅 All appointments
                </a>
            </div>
        </div>

        <div id="rc-today"></div>
        ` +
        `<div id="rc-today"></div>`;

    el.querySelector('#rc-today').innerHTML =
        `<h3 style="margin:0 0 12px">
            TODAY'S APPOINTMENTS
        </h3>` +
        R.table(
            [
                [
                    'Token',
                    a =>
                        R.tokenText(a)
                            ? `<strong>${R.tokenText(a)}</strong>`
                            : '<span class="text-mute">Pending</span>'
                ],

                [
                    'Time',
                    a =>
                        `<span class="text-acc fw-600">
                            ${esc(a.slot)}
                         </span>`
                ],

                [
                    'Patient',
                    a =>
                        `<span class="fw-600">
                            ${esc(R.patientName(a.patient))}
                         </span>
                         <span class="rc-sub">
                            ${esc(a.patient)}
                         </span>`
                ],

                [
                    'Doctor',
                    a =>
                        esc(R.doctorName(a.doctor))
                ],

                [
                    'Payment',
                    a => {
                        const b =
                            R.appointmentBill(a.id);

                        return CMS.badge(
                            b
                                ? R.billStatus(b)
                                : 'PENDING'
                        );
                    }
                ],

                [
                    'Status',
                    a => CMS.badge(a.status)
                ],

                [
                    'Action',
                    a => {
                        const b =
                            R.appointmentBill(a.id);

                        return (
                            a.status === 'SCHEDULED' &&
                            (!b || R.billStatus(b) === 'PENDING') &&
                            b
                        )
                            ? `<div class="rc-acts">
                                ${CMS.btn(
                                    'pay',
                                    b.id,
                                    '💳 Collect payment'
                                )}
                               </div>`
                            : '';
                    }
                ]
            ],
            todays,
            'No appointments for today'
        );

    R.onClicks(
        el,
        {
            pay: id => R.payNow(id)
        }
    );
}],


/* ---------------------------------------------------------
   1. PATIENTS  (register / search / book / history / edit)
   --------------------------------------------------------- */
['Patients', el => {
    const st = {
        q: ''
    };

    el.innerHTML =
        R.head(
            'Patients',
            '<span id="rc-count"></span>',
            `<input
                class="search"
                id="rc-q"
                placeholder="ID, name or phone…"
                aria-label="Search patients"
                autocomplete="off"
            >
            <button class="btn" data-a="new">
                + New Patient
            </button>`
        ) +
        '<div id="rc-body"></div>';

    const q = el.querySelector('#rc-q');

    const draw = () => {
        const rows =
            R.searchPatients(st.q)
                .slice()
                .reverse();

        el.querySelector('#rc-count').textContent =
            `${rows.length} patient${rows.length === 1 ? '' : 's'}${st.q ? ' found' : ' registered'}`;

        el.querySelector('#rc-body').innerHTML =
            R.table(
                [
                    [
                        'ID',
                        p =>
                            `<span class="fw-600">
                                ${esc(p.id)}
                             </span>`
                    ],

                    [
                        'Name',
                        p =>
                            `<button
                                class="rc-link"
                                data-a="hist"
                                data-id="${esc(p.id)}"
                                title="View history"
                            >
                                ${esc(p.name)}
                            </button>`
                    ],

                    [
                        'Phone',
                        p => esc(p.phone)
                    ],

                    [
                        'DOB',
                        p =>
                            `${esc(p.dob)}
                             <span class="rc-sub">
                                ${esc(R.ageText(p.dob))}
                             </span>`
                    ],

                    [
                        'Gender',
                        p => esc(p.gender)
                    ],

                    [
                        'Blood',
                        p =>
                            `<span class="badge">
                                ${esc(p.blood)}
                             </span>`
                    ],

                    [
                        'Allergies',
                        p =>
                            p.allergies
                                ? `<span class="text-warn fs-sm">
                                    ${esc(p.allergies)}
                                   </span>`
                                : '<span class="text-mute fs-sm">None</span>'
                    ],

                    [
                        'Due',
                        p => {
                            const d =
                                R.pendingAmount(p.id);

                            return d
                                ? `<span class="text-bad fw-600">
                                    ${R.money(d)}
                                   </span>`
                                : '<span class="text-mute">—</span>';
                        }
                    ],

                    [
                        'Action',
                        p =>
                            `<div class="rc-acts">
                                ${CMS.btn(
                                    'book',
                                    p.id,
                                    '📅 Book'
                                )}

                                ${CMS.btn(
                                    'hist',
                                    p.id,
                                    '📜 History',
                                    'ghost'
                                )}

                                ${CMS.btn(
                                    'edit',
                                    p.id,
                                    '✏️ Edit',
                                    'ghost'
                                )}
                             </div>`
                    ]
                ],
                rows,
                st.q
                    ? `No patient found for “${esc(st.q)}”.<br><br>
                       <button class="btn sm" data-a="newq">
                           + Register as new patient
                       </button>`
                    : 'No patients yet — click “+ New Patient”.'
            );
    };

    const need = id => {
        const p = R.patient(id);

        if (!p) {
            throw Error('Patient not found');
        }

        return p;
    };

    const newPatient = prefill =>
        R.patientForm(
            null,
            saved => {
                st.q = '';
                q.value = '';
                draw();

                R.openBooking(
                    saved,
                    {
                        onCancel: () =>
                            CMS.toast(
                                'Patient saved. Use 📅 Book on the list when ready.'
                            ),
                        onBooked: draw
                    }
                );
            },
            prefill
        );

    R.onClicks(
        el,
        {
            new: () => newPatient(),

            newq: () =>
                newPatient(
                    /^\d+$/.test(st.q)
                        ? { phone: st.q }
                        : /^P\d+$/i.test(st.q)
                            ? {}
                            : { name: st.q }
                ),

            book: id =>
                R.openBooking(
                    need(id),
                    {
                        onBooked: draw
                    }
                ),

            hist: id =>
                R.openHistory(
                    need(id),
                    {
                        onChange: draw
                    }
                ),

            edit: id =>
                R.patientForm(
                    need(id),
                    draw
                )
        }
    );

    q.oninput = () => {
        st.q = q.value;
        draw();
    };

    draw();

    const qs =
        new URLSearchParams(location.search);

    if (qs.get('new')) {
        history.replaceState(
            null,
            '',
            location.pathname
        );

        newPatient();

    } else if (qs.get('find')) {
        history.replaceState(
            null,
            '',
            location.pathname
        );

        q.focus();
    }
}],


/* ---------------------------------------------------------
   2. APPOINTMENTS
   --------------------------------------------------------- */
['Appointments', el => {
    const today = CMS.today();

    const has = f =>
        R.appointments().some(f);

    const st = {
        q: '',
        f: has(a => a.date === today)
            ? 'today'
            : 'all'
    };

    el.innerHTML =
        R.head(
            'Appointments',
            '',
            `<input
                class="search"
                id="rc-q"
                placeholder="Patient, doctor, ID…"
                aria-label="Search appointments"
                autocomplete="off"
            >
            <button class="btn" data-a="book">
                + Book appointment
            </button>`
        ) +
        '<div id="rc-body"></div>';

    const filters = {
        today: a => a.date === today,
        scheduled: a => a.status === 'SCHEDULED',
        completed: a => a.status === 'COMPLETED',
        cancelled: a => a.status === 'CANCELLED',
        all: () => true
    };

    const label = {
        today: 'Today',
        scheduled: 'Scheduled',
        completed: 'Completed',
        cancelled: 'Cancelled',
        all: 'All'
    };

    const payOf = a => {
        const b =
            R.appointmentBill(a.id);

        return b
            ? R.billStatus(b)
            : 'PENDING';
    };

    const draw = () => {
        const all = R.appointments();

        const q =
            st.q
                .trim()
                .toLowerCase();

        const rows =
            all
                .filter(filters[st.f])
                .filter(
                    a =>
                        !q ||
                        [
                            a.id,
                            a.date,
                            a.slot,
                            a.patient,
                            R.patientName(a.patient),
                            R.doctorName(a.doctor),
                            R.tokenText(a) || ''
                        ]
                            .join(' ')
                            .toLowerCase()
                            .includes(q)
                )
                .sort(
                    (a, b) =>
                        (a.date + a.slot)
                            .localeCompare(
                                b.date + b.slot
                            ) *
                        (
                            ['today', 'scheduled']
                                .includes(st.f)
                                ? 1
                                : -1
                        )
                );

        el.querySelector('#rc-body').innerHTML =
            R.chips(
                Object.keys(label)
                    .map(k => [
                        k,
                        label[k],
                        all.filter(filters[k]).length
                    ]),
                st.f
            ) +
            R.table(
                [
                    [
                        'Token',
                        a =>
                            R.tokenText(a)
                                ? `<strong>${R.tokenText(a)}</strong>`
                                : a.status === 'CANCELLED' &&
                                  a.cancelled_token_number
                                    ? `<span class="text-mute">
                                        Released ${pad2(a.cancelled_token_number)}
                                       </span>`
                                    : '<span class="text-mute">Pending</span>'
                    ],

                    [
                        'ID',
                        a => esc(a.id)
                    ],

                    [
                        'Date',
                        a =>
                            `<span class="fw-600">
                                ${esc(a.date)}
                             </span>`
                    ],

                    [
                        'Time',
                        a =>
                            `<span class="text-acc fw-600">
                                ${esc(a.slot)}
                             </span>`
                    ],

                    [
                        'Patient',
                        a =>
                            `<button
                                class="rc-link"
                                data-a="hist"
                                data-id="${esc(a.patient)}"
                                title="View history"
                            >
                                ${esc(R.patientName(a.patient))}
                            </button>

                            <span class="rc-sub">
                                ${esc(a.patient)}
                            </span>`
                    ],

                    [
                        'Doctor',
                        a =>
                            esc(
                                R.doctorName(a.doctor)
                            )
                    ],

                    [
                        'Payment',
                        a =>
                            a.status === 'CANCELLED'
                                ? '<span class="text-mute">—</span>'
                                : CMS.badge(payOf(a))
                    ],

                    [
                        'Status',
                        a =>
                            CMS.badge(a.status)
                    ],

                    [
                        'Action',
                        a => {
                            if (a.status !== 'SCHEDULED') {
                                return `<div class="rc-acts">
                                    ${CMS.btn(
                                        'hist',
                                        a.patient,
                                        '📜 History',
                                        'ghost'
                                    )}
                                </div>`;
                            }

                            const b =
                                R.appointmentBill(a.id);

                            const unpaid =
                                payOf(a) === 'PENDING';

                            return `<div class="rc-acts">
                                ${
                                    unpaid && b
                                        ? CMS.btn(
                                            'pay',
                                            b.id,
                                            '💳 Pay'
                                        )
                                        : ''
                                }

                                ${CMS.btn(
                                    'edit',
                                    a.id,
                                    'Edit',
                                    'ghost'
                                )}

                                ${CMS.btn(
                                    'cancel',
                                    a.id,
                                    'Cancel',
                                    'bad'
                                )}
                            </div>`;
                        }
                    ]
                ],
                rows,
                'No appointments here. Use “+ Book appointment”.'
            );
    };

    el.addEventListener(
        'click',
        ev => {
            const c =
                ev.target.closest('[data-chip]');

            if (c) {
                st.f = c.dataset.chip;
                draw();
            }
        }
    );

    R.onClicks(
        el,
        {
            book: () =>
                R.openPatientPicker(
                    'Book Appointment — Find Patient',
                    p =>
                        R.openBooking(
                            p,
                            {
                                onBooked: draw
                            }
                        )
                ),

            hist: id => {
                const p = R.patient(id);

                if (!p) {
                    throw Error('Patient not found');
                }

                R.openHistory(
                    p,
                    {
                        onChange: draw
                    }
                );
            },

            pay: id =>
                R.payNow(id),

            edit: id => {
                const a = R.appointment(id);

                if (!a) {
                    throw Error('Appointment not found');
                }

                R.openEditAppointment(
                    a,
                    draw
                );
            },

            cancel: id => {
                if (
                    !confirm(
                        'Cancel this appointment? Payment already made will NOT be refunded.'
                    )
                ) {
                    return;
                }

                R.cancelAppointment(id);

                CMS.toast(
                    'Appointment cancelled. No refund is given.'
                );

                draw();
            }
        }
    );

    el.querySelector('#rc-q').oninput =
        e => {
            st.q = e.target.value;
            draw();
        };

    draw();
}],


/* ---------------------------------------------------------
   3. BILLING
   --------------------------------------------------------- */
['Billing', el => {
    const pendingBill = b =>
        R.billStatus(b) === 'PENDING';

    const st = {
        q: '',
        f: R.bills().some(pendingBill)
            ? 'pending'
            : 'all'
    };

    el.innerHTML =
        R.head(
            'Billing',
            '',
            `<input
                class="search"
                id="rc-q"
                placeholder="Bill, patient…"
                aria-label="Search bills"
                autocomplete="off"
            >`
        ) +
        '<div id="rc-body"></div>';

    const filters = {
        pending: pendingBill,
        paid: b => R.billStatus(b) === 'PAID',
        all: () => true
    };

    const label = {
        pending: 'Pending',
        paid: 'Paid',
        all: 'All'
    };

    const progress = b => {
        const t =
            R.billTotal(b);

        const pct =
            t > 0
                ? Math.min(
                    100,
                    Math.round(
                        Number(b.paid || 0) /
                        t *
                        100
                    )
                )
                : 0;

        return `
            <div
                style="display:flex;align-items:center;gap:8px;min-width:110px"
            >
                <div
                    style="flex:1;height:6px;background:var(--line);border-radius:99px;overflow:hidden"
                >
                    <div
                        style="width:${pct}%;height:100%;background:${pct >= 100 ? 'var(--good)' : 'var(--warn)'};border-radius:99px"
                    ></div>
                </div>

                <span class="fs-sm text-mute">
                    ${pct}%
                </span>
            </div>`;
    };

    const tokens = b => {
        const items =
            R.consultItems(b);

        if (!items.length) {
            return '<span class="text-mute">—</span>';
        }

        return items
            .map(i => {
                const a =
                    R.appointment(i.ref);

                if (R.tokenText(a)) {
                    return `<strong>
                        ${R.tokenText(a)}
                    </strong>`;
                }

                if (
                    a &&
                    a.status === 'CANCELLED' &&
                    a.cancelled_token_number
                ) {
                    return `<span class="text-mute">
                        Cancelled ${pad2(a.cancelled_token_number)}
                    </span>`;
                }

                return '<span class="text-mute">Pending</span>';
            })
            .join(', ');
    };

    const draw = () => {
        const all =
            R.bills()
                .filter(
                    b =>
                        R.billTotal(b) > 0
                );

        const q =
            st.q
                .trim()
                .toLowerCase();

        const rows =
            all
                .filter(filters[st.f])
                .filter(
                    b =>
                        !q ||
                        [
                            b.id,
                            b.patient,
                            R.patientName(b.patient),
                            b.payment_method || ''
                        ]
                            .join(' ')
                            .toLowerCase()
                            .includes(q)
                )
                .slice()
                .reverse();

        el.querySelector('#rc-body').innerHTML =
            R.chips(
                Object.keys(label)
                    .map(k => [
                        k,
                        label[k],
                        all.filter(filters[k]).length
                    ]),
                st.f
            ) +
            R.table(
                [
                    [
                        'Bill',
                        b =>
                            `<span class="fw-600">
                                ${esc(b.id)}
                             </span>
                             <span class="rc-sub">
                                ${esc(b.date || '')}
                             </span>`
                    ],

                    [
                        'Patient',
                        b =>
                            `<button
                                class="rc-link"
                                data-a="hist"
                                data-id="${esc(b.patient)}"
                                title="View history"
                            >
                                ${esc(R.patientName(b.patient))}
                            </button>

                            <span class="rc-sub">
                                ${esc(b.patient)}
                            </span>`
                    ],

                    [
                        'Charges',
                        b =>
                            (b.items || [])
                                .map(
                                    i =>
                                        `${esc(i.desc)} (${R.money(i.amount)})`
                                )
                                .join(', ') ||
                            '—'
                    ],

                    [
                        'Total',
                        b =>
                            R.money(
                                R.billTotal(b)
                            )
                    ],

                    [
                        'Paid',
                        b =>
                            R.money(
                                b.paid
                            )
                    ],

                    [
                        'Due',
                        b => {
                            const d =
                                R.billDue(b);

                            return d
                                ? `<span class="text-bad fw-600">
                                    ${R.money(d)}
                                   </span>`
                                : '<span class="text-good fw-600">₹ 0</span>';
                        }
                    ],

                    [
                        'Progress',
                        progress
                    ],

                    [
                        'Payment',
                        b =>
                            CMS.badge(
                                R.billStatus(b)
                            )
                    ],

                    [
                        'Method',
                        b =>
                            b.payment_method
                                ? esc(b.payment_method)
                                : '<span class="text-mute">—</span>'
                    ],

                    [
                        'Token',
                        tokens
                    ],

                    [
                        'Action',
                        b =>
                            pendingBill(b)
                                ? `<div class="rc-acts">
                                    ${CMS.btn(
                                        'pay',
                                        b.id,
                                        '💳 Collect payment'
                                    )}
                                   </div>`
                                : ''
                    ]
                ],
                rows,
                st.f === 'pending'
                    ? 'No pending bills 🎉'
                    : 'No bills found'
            );
    };

    el.addEventListener(
        'click',
        ev => {
            const c =
                ev.target.closest('[data-chip]');

            if (c) {
                st.f = c.dataset.chip;
                draw();
            }
        }
    );

    R.onClicks(
        el,
        {
            pay: id => {
                const b =
                    R.bill(id);

                if (!b) {
                    throw Error('Bill not found');
                }

                R.openPayment(
                    b,
                    draw
                );
            },

            hist: id => {
                const p =
                    R.patient(id);

                if (!p) {
                    throw Error('Patient not found');
                }

                R.openHistory(
                    p,
                    {
                        onChange: draw
                    }
                );
            }
        }
    );

    el.querySelector('#rc-q').oninput =
        e => {
            st.q = e.target.value;
            draw();
        };

    draw();

    /* arriving from "Book & collect payment" /
       "Pay" buttons -> open the payment pop-up */
    const payId =
        sessionStorage.getItem(
            'reception_pay_bill'
        );

    if (payId) {
        sessionStorage.removeItem(
            'reception_pay_bill'
        );

        const b =
            R.bill(payId);

        if (
            b &&
            pendingBill(b)
        ) {
            R.openPayment(
                b,
                draw
            );
        }
    }
}]

];

})();