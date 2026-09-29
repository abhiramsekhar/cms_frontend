/* =========================================================
   RECEPTIONIST FRONTEND
   ---------------------------------------------------------
   Pages:
   0 - Dashboard
   1 - Patients
   2 - Appointments
   3 - Billing

   FLOW:

   NEW PATIENT
   → Patient ID created once
   → Registration fee ₹100
   → Book appointment
   → Consultation fee ₹300
   → Full consultation payment
   → Token generated

   EXISTING PATIENT
   → Use existing Patient ID
   → No new Patient ID
   → Book appointment
   → Consultation fee ₹300
   → Full consultation payment
   → Token generated

   TOKEN:
   Doctor + Date based
   Example:
   Doctor A - 28 Sep → 1,2,3
   Doctor A - 29 Sep → 1,2,3
   Doctor B - 28 Sep → 1,2,3
   ========================================================= */


const RECEPTION_FEES = {
    registration: 100,
    consultation: 300
};


/* =========================================================
   RECEPTIONIST HELPERS
   ========================================================= */

const R = {

    /* ---------- DATA ---------- */

    patients: () =>
        CMS.all('patients'),

    activePatients: () =>
        CMS.all('patients').filter(
            p => p.is_active
        ),

    doctors: () =>
        CMS.all('users').filter(
            u =>
                u.role === 'DOCTOR' &&
                u.is_active
        ),

    appointments: () =>
        CMS.all('appointments'),

    bills: () =>
        CMS.all('bills'),


    patient: id =>
        CMS.get('patients', id),

    doctor: id =>
        CMS.get('users', id),

    appointment: id =>
        CMS.get('appointments', id),

    bill: id =>
        CMS.get('bills', id),


    /* =====================================================
       DISPLAY HELPERS
       ===================================================== */

    money: amount =>
        '₹ ' +
        Number(amount || 0).toLocaleString('en-IN'),


    patientName: id => {

        const p = CMS.get(
            'patients',
            id
        );

        return p
            ? p.name
            : 'Unknown patient';
    },


    doctorName: id => {

        const d = CMS.get(
            'users',
            id
        );

        return d
            ? d.name
            : 'Unknown doctor';
    },


    /* =====================================================
       BILL HELPERS
       ===================================================== */

    billTotal: bill => {

        if (
            !bill ||
            !Array.isArray(bill.items)
        ) {
            return 0;
        }

        return bill.items.reduce(
            (total, item) =>
                total +
                Number(item.amount || 0),
            0
        );
    },


    billDue: bill => {

        return Math.max(
            0,
            R.billTotal(bill) -
            Number(bill.paid || 0)
        );
    },


    billStatus: bill => {

        const total =
            R.billTotal(bill);

        const paid =
            Number(bill.paid || 0);

        if (
            total > 0 &&
            paid >= total
        ) {
            return 'PAID';
        }

        if (paid > 0) {
            return 'PARTIAL';
        }

        return 'UNPAID';
    },


    /* =====================================================
       FIND REGISTRATION BILL
       ===================================================== */

    registrationBill: patientId => {

        return R.bills().find(
            bill =>
                bill.patient === patientId &&
                Array.isArray(bill.items) &&
                bill.items.some(
                    item =>
                        item.refType ===
                        'REGISTRATION'
                )
        );
    },


    /* =====================================================
       FIND CONSULTATION BILL
       ===================================================== */

    appointmentBill: appointmentId => {

        return R.bills().find(
            bill =>
                Array.isArray(bill.items) &&
                bill.items.some(
                    item =>
                        item.refType ===
                            'CONSULTATION' &&
                        item.ref === appointmentId
                )
        );
    },


    /* =====================================================
       FIND EXISTING PATIENT
       ===================================================== */

    findExistingPatient: phone => {

        return R.patients().find(
            p =>
                p.phone === phone &&
                p.is_active
        );
    },


    /* =====================================================
       EDIT EXISTING PATIENT
       -----------------------------------------------------
       This form is receptionist-specific.

       We are NOT changing core.js.

       Patient ID is displayed but cannot be changed.
       ===================================================== */

    editPatient: (patient, done) => {

        const V = CMS.V;

        const m =
            document.createElement('div');

        m.className = 'modal';


        m.innerHTML = `

            <form
                class="card"
                novalidate
            >

                <h3>
                    Edit Patient Details
                </h3>


                <p class="text-mute fs-sm">

                    Patient ID:
                    <strong>
                        ${CMS.esc(patient.id)}
                    </strong>

                </p>


                <br>


                <!-- NAME -->

                <label>

                    Full name *

                    <input
                        name="name"
                        value="${CMS.esc(
                            patient.name || ''
                        )}"
                    >

                    <small class="err"></small>

                </label>


                <!-- PHONE -->

                <label>

                    Phone *

                    <input
                        name="phone"
                        type="text"
                        inputmode="numeric"
                        maxlength="10"
                        value="${CMS.esc(
                            patient.phone || ''
                        )}"
                    >

                    <small class="err"></small>

                </label>


                <!-- EMAIL -->

                <label>

                    Email

                    <input
                        name="email"
                        type="email"
                        value="${CMS.esc(
                            patient.email || ''
                        )}"
                    >

                    <small class="err"></small>

                </label>


                <!-- DOB -->

                <label>

                    Date of birth *

                    <input
                        name="dob"
                        type="date"
                        max="${CMS.today()}"
                        value="${CMS.esc(
                            patient.dob || ''
                        )}"
                    >

                    <small class="err"></small>

                </label>


                <!-- GENDER -->

                <label>

                    Gender *

                    <select name="gender">

                        <option value="">
                            Select…
                        </option>

                        <option
                            value="Female"
                            ${
                                patient.gender === 'Female'
                                    ? 'selected'
                                    : ''
                            }
                        >
                            Female
                        </option>

                        <option
                            value="Male"
                            ${
                                patient.gender === 'Male'
                                    ? 'selected'
                                    : ''
                            }
                        >
                            Male
                        </option>

                        <option
                            value="Other"
                            ${
                                patient.gender === 'Other'
                                    ? 'selected'
                                    : ''
                            }
                        >
                            Other
                        </option>

                    </select>

                    <small class="err"></small>

                </label>


                <!-- BLOOD GROUP -->

                <label>

                    Blood group *

                    <select name="blood">

                        <option value="">
                            Select…
                        </option>

                        ${
                            [
                                'A+',
                                'A-',
                                'B+',
                                'B-',
                                'AB+',
                                'AB-',
                                'O+',
                                'O-'
                            ]
                            .map(
                                blood =>
                                    `<option
                                        value="${blood}"
                                        ${
                                            patient.blood === blood
                                                ? 'selected'
                                                : ''
                                        }
                                    >
                                        ${blood}
                                    </option>`
                            )
                            .join('')
                        }

                    </select>

                    <small class="err"></small>

                </label>


                <!-- ADDRESS -->

                <label>

                    Address *

                    <textarea
                        name="address"
                        rows="2"
                    >${CMS.esc(
                        patient.address || ''
                    )}</textarea>

                    <small class="err"></small>

                </label>


                <!-- EMERGENCY CONTACT -->

                <label>

                    Emergency contact phone *

                    <input
                        name="emergency"
                        type="text"
                        inputmode="numeric"
                        maxlength="10"
                        value="${CMS.esc(
                            patient.emergency || ''
                        )}"
                    >

                    <small class="err"></small>

                </label>


                <!-- ALLERGIES -->

                <label>

                    Allergies

                    <textarea
                        name="allergies"
                        rows="2"
                    >${CMS.esc(
                        patient.allergies || ''
                    )}</textarea>

                    <small class="err"></small>

                </label>


                <!-- BUTTONS -->

                <div class="row">

                    <button
                        type="button"
                        class="btn ghost"
                        data-x
                    >
                        Cancel
                    </button>


                    <button class="btn">
                        Save Changes
                    </button>

                </div>

            </form>

        `;


        const fm =
             m.querySelector('form');


        /* =================================================
           FORM SUBMIT
           ================================================= */

        fm.onsubmit = e => {

            e.preventDefault();


            const value = {

                name:
                    fm.elements.name.value.trim(),

                phone:
                    fm.elements.phone.value.trim(),

                email:
                    fm.elements.email.value.trim(),

                dob:
                    fm.elements.dob.value.trim(),

                gender:
                    fm.elements.gender.value.trim(),

                blood:
                    fm.elements.blood.value.trim(),

                address:
                    fm.elements.address.value.trim(),

                emergency:
                    fm.elements.emergency.value.trim(),

                allergies:
                    fm.elements.allergies.value.trim()

            };


            let bad = 0;


            /* =================================================
               ERROR HELPER
               ================================================= */

            const error = (
                field,
                message
            ) => {

                fm.elements[field]
                    .parentNode
                    .querySelector('.err')
                    .textContent = message;


                if (message) {
                    bad++;
                }

            };


            /* =================================================
               VALIDATE NAME
               ================================================= */

            error(
                'name',

                !value.name
                    ? 'Required'
                    : V.name(value.name)
            );


            /* =================================================
               VALIDATE PHONE
               ================================================= */

            error(
                'phone',

                !value.phone
                    ? 'Required'
                    : V.phone(value.phone)
            );


            /* =================================================
               VALIDATE EMAIL
               ================================================= */

            error(
                'email',

                value.email
                    ? V.email(value.email)
                    : ''
            );


            /* =================================================
               VALIDATE DOB
               ================================================= */

            error(
                'dob',

                !value.dob
                    ? 'Required'
                    : V.dob(value.dob)
            );


            /* =================================================
               VALIDATE GENDER
               ================================================= */

            error(
                'gender',

                !value.gender
                    ? 'Required'
                    : ''
            );


            /* =================================================
               VALIDATE BLOOD
               ================================================= */

            error(
                'blood',

                !value.blood
                    ? 'Required'
                    : ''
            );


            /* =================================================
               VALIDATE ADDRESS
               ================================================= */

            error(
                'address',

                !value.address
                    ? 'Required'
                    : ''
            );


            /* =================================================
               VALIDATE EMERGENCY CONTACT
               ================================================= */

            let emergencyError = '';


            if (!value.emergency) {

                emergencyError =
                    'Required';

            }

            else {

                emergencyError =
                    V.phone(
                        value.emergency
                    ) ||
                    V.notPhone(
                        value.emergency,
                        value
                    );

            }


            error(
                'emergency',
                emergencyError
            );


            /* =================================================
               ALLERGIES ARE OPTIONAL
               ================================================= */

            error(
                'allergies',
                ''
            );


            /* =================================================
               STOP IF VALIDATION FAILED
               ================================================= */

            if (bad) {
                return;
            }


            /* =================================================
               DUPLICATE PHONE CHECK
               -------------------------------------------------
               Ignore the current patient's own phone.
               ================================================= */

            const duplicate =
                R.patients().find(
                    p =>
                        p.is_active &&
                        p.phone === value.phone &&
                        p.id !== patient.id
                );


            if (duplicate) {

                error(
                    'phone',
                    `Phone already belongs to patient ${duplicate.id}`
                );

                return;
            }


            /* =================================================
               UPDATE EXISTING PATIENT
               -------------------------------------------------
               Patient ID is NOT changed.
               ================================================= */

            try {

                CMS.tx(() => {

                    Object.assign(
                        patient,
                        value
                    );

                });


                m.remove();


                CMS.toast(
                    `Patient ${patient.id} updated successfully`
                );


                done &&
                    done();

            }

            catch (error) {

                CMS.toast(
                    error.message,
                    false
                );

            }

        };


        /* =================================================
           CANCEL
           ================================================= */

        fm.querySelector(
            '[data-x]'
        ).onclick = () => {

            m.remove();

        };


        /* =================================================
           SHOW MODAL
           ================================================= */

        document.body.append(m);


        fm.elements.name.focus();

    },


    /* =====================================================
       TOKEN GENERATION
       -----------------------------------------------------
       TOKEN IS UNIQUE FOR:

       DOCTOR + DATE
       ===================================================== */

    generateToken: (doctorId, date) => {

        const appointments =
            R.appointments().filter(
                appointment =>
                    appointment.doctor === doctorId &&
                    appointment.date === date &&
                    appointment.status !== 'CANCELLED' &&
                    appointment.token_number !== null &&
                    appointment.token_number !== undefined
            );


        if (!appointments.length) {
            return 1;
        }


        const numbers =
            appointments.map(
                appointment =>
                    Number(
                        appointment.token_number
                    )
            );


        return Math.max(...numbers) + 1;
    },


    /* =====================================================
       COMPLETE PAYMENT
       -----------------------------------------------------
       Token is created when the consultation bill
       is completely paid.
       ===================================================== */

    completePayment: (
        billId,
        amount,
        method
    ) => {

        return CMS.tx(() => {

            const bill =
                CMS.get(
                    'bills',
                    billId
                );


            if (!bill) {

                throw Error(
                    'Bill not found'
                );

            }


            const paymentAmount =
                Number(amount);


            if (
                !Number.isFinite(
                    paymentAmount
                ) ||
                paymentAmount <= 0
            ) {

                throw Error(
                    'Enter a valid payment amount'
                );

            }


            const due =
                R.billDue(bill);


            if (paymentAmount > due) {

                throw Error(
                    `Amount cannot be more than the balance due of ${R.money(due)}`
                );

            }


            if (
                ![
                    'CASH',
                    'CARD',
                    'UPI'
                ].includes(method)
            ) {

                throw Error(
                    'Select a valid payment method'
                );

            }


            /* ---------- SAVE PAYMENT ---------- */

            bill.paid =
                Math.round(
                    (
                        Number(
                            bill.paid || 0
                        ) +
                        paymentAmount
                    ) * 100
                ) / 100;


            bill.payment_method =
                method;


            bill.last_payment_date =
                CMS.today();


            /* =================================================
               CHECK CONSULTATION BILL
               ================================================= */

            const consultationItem =
                bill.items.find(
                    item =>
                        item.refType ===
                        'CONSULTATION'
                );


            if (
                consultationItem &&
                R.billStatus(bill) === 'PAID'
            ) {

                const appointment =
                    CMS.get(
                        'appointments',
                        consultationItem.ref
                    );


                if (!appointment) {

                    throw Error(
                        'Appointment not found'
                    );

                }


                /* =================================================
                   PAYMENT STATUS = PAID
                   ================================================= */

                appointment.payment_status =
                    'PAID';


                /* =================================================
                   GENERATE TOKEN
                   ONLY AFTER FULL PAYMENT
                   ================================================= */

                if (
                    appointment.status ===
                        'SCHEDULED' &&
                    !appointment.token_number
                ) {

                    const token =
                        R.generateToken(
                            appointment.doctor,
                            appointment.date
                        );


                    appointment.token_number =
                        token;


                    appointment.token_generated =
                        true;

                }

            }


            return bill;

        });

    }

};


/* =========================================================
   RECEPTIONIST MODULES
   ========================================================= */

CMS.mods.RECEPTIONIST = [


/* =========================================================
   0. DASHBOARD
   ========================================================= */

[
    'Dashboard',

    el => {

        const today =
            CMS.today();


        const patients =
            R.patients();


        const appointments =
            R.appointments();


        const bills =
            R.bills();


        /* =====================================================
           TODAY'S PATIENTS
           ===================================================== */

        const todayPatients =
            patients.filter(
                patient =>
                    patient.registered === today
            );


        /* =====================================================
           TODAY'S APPOINTMENTS
           ===================================================== */

        const todayAppointments =
            appointments
                .filter(
                    appointment =>
                        appointment.date === today &&
                        appointment.status !== 'CANCELLED'
                )
                .sort(
                    (a, b) => {

                        if (
                            a.token_number &&
                            b.token_number
                        ) {

                            return Number(
                                a.token_number
                            ) -
                            Number(
                                b.token_number
                            );

                        }


                        return String(
                            a.slot || ''
                        ).localeCompare(
                            String(
                                b.slot || ''
                            )
                        );

                    }
                );


        /* =====================================================
           TODAY'S COLLECTION
           ===================================================== */

        const todayCollection =
            bills
                .filter(
                    bill =>
                        bill.last_payment_date ===
                        today
                )
                .reduce(
                    (
                        total,
                        bill
                    ) =>
                        total +
                        Number(
                            bill.paid || 0
                        ),
                    0
                );


        /* =====================================================
           PENDING PAYMENTS
           ===================================================== */

        const pendingPayments =
            bills.filter(
                bill =>
                    R.billDue(bill) > 0
            ).length;


        /* =====================================================
           DASHBOARD HTML
           ===================================================== */

        el.innerHTML = `

            <div class="head">

                <div>

                    <h2>
                        Receptionist Dashboard
                    </h2>

                    <p class="text-mute fs-sm">
                        Welcome to Clinic CMS
                    </p>

                </div>

            </div>


            <!-- STAT CARDS -->

            <div style="
                display:grid;
                grid-template-columns:
                    repeat(4,1fr);
                gap:16px;
                margin-bottom:24px;
            ">


                <!-- TODAY'S PATIENTS -->

                <div
                    class="card"
                    style="padding:20px;"
                >

                    <div class="text-mute fs-sm">
                        👥 Today's Patients
                    </div>

                    <div style="
                        font-size:30px;
                        font-weight:800;
                        margin-top:8px;
                    ">

                        ${todayPatients.length}

                    </div>

                </div>


                <!-- TODAY'S APPOINTMENTS -->

                <div
                    class="card"
                    style="padding:20px;"
                >

                    <div class="text-mute fs-sm">
                        📅 Today's Appointments
                    </div>

                    <div style="
                        font-size:30px;
                        font-weight:800;
                        margin-top:8px;
                    ">

                        ${todayAppointments.length}

                    </div>

                </div>


                <!-- TODAY'S COLLECTION -->

                <div
                    class="card"
                    style="padding:20px;"
                >

                    <div class="text-mute fs-sm">
                        💰 Today's Collection
                    </div>

                    <div style="
                        font-size:30px;
                        font-weight:800;
                        margin-top:8px;
                    ">

                        ${R.money(
                            todayCollection
                        )}

                    </div>

                </div>


                <!-- PENDING PAYMENTS -->

                <div
                    class="card"
                    style="padding:20px;"
                >

                    <div class="text-mute fs-sm">
                        ⏳ Pending Payments
                    </div>

                    <div style="
                        font-size:30px;
                        font-weight:800;
                        margin-top:8px;
                    ">

                        ${pendingPayments}

                    </div>

                </div>

            </div>


            <!-- QUICK ACTIONS -->

            <div
                class="card"
                style="
                    padding:20px;
                    margin-bottom:24px;
                "
            >

                <h3 style="margin-top:0;">
                    QUICK ACTIONS
                </h3>


                <div style="
                    display:flex;
                    flex-wrap:wrap;
                    gap:12px;
                ">


                    <button
                        class="btn"
                        onclick="
                            location.href='patients.html'
                        "
                    >
                        + New Patient
                    </button>


                    <button
                        class="btn"
                        onclick="
                            location.href='appointments.html'
                        "
                    >
                        📅 Book Appointment
                    </button>


                    <button
                        class="btn ghost"
                        onclick="
                            location.href='patients.html'
                        "
                    >
                        🔍 Find Patient
                    </button>


                    <button
                        class="btn ghost"
                        onclick="
                            location.href='billing.html'
                        "
                    >
                        💰 Billing
                    </button>

                </div>

            </div>


            <!-- TODAY'S APPOINTMENTS -->

            <div class="card scroll">

                <div
                    style="
                        padding:
                            20px 20px 10px;
                    "
                >

                    <h3 style="margin:0;">
                        TODAY'S APPOINTMENTS
                    </h3>

                </div>


                <table>

                    <thead>

                        <tr>

                            <th>Token</th>
                            <th>Patient ID</th>
                            <th>Patient</th>
                            <th>Doctor</th>
                            <th>Time</th>
                            <th>Payment</th>
                            <th>Status</th>

                        </tr>

                    </thead>


                    <tbody>

                        ${
                            todayAppointments.length

                            ?

                            todayAppointments
                                .map(
                                    appointment => {

                                        const bill =
                                            R.appointmentBill(
                                                appointment.id
                                            );


                                        const payment =
                                            bill
                                                ? R.billStatus(
                                                    bill
                                                )
                                                : 'UNPAID';


                                        const token =
                                            appointment.token_number
                                                ? String(
                                                    appointment.token_number
                                                ).padStart(
                                                    2,
                                                    '0'
                                                )
                                                : 'Pending';


                                        return `

                                            <tr>

                                                <td>
                                                    <strong>
                                                        ${token}
                                                    </strong>
                                                </td>


                                                <td>
                                                    ${CMS.esc(
                                                        appointment.patient
                                                    )}
                                                </td>


                                                <td>
                                                    ${CMS.esc(
                                                        R.patientName(
                                                            appointment.patient
                                                        )
                                                    )}
                                                </td>


                                                <td>
                                                    ${CMS.esc(
                                                        R.doctorName(
                                                            appointment.doctor
                                                        )
                                                    )}
                                                </td>


                                                <td>
                                                    ${CMS.esc(
                                                        appointment.slot
                                                    )}
                                                </td>


                                                <td>
                                                    ${CMS.badge(
                                                        payment
                                                    )}
                                                </td>


                                                <td>
                                                    ${CMS.badge(
                                                        appointment.status
                                                    )}
                                                </td>

                                            </tr>

                                        `;

                                    }
                                )
                                .join('')

                            :

                            `
                                <tr>

                                    <td
                                        colspan="7"
                                        class="empty"
                                    >
                                        No appointments
                                        for today
                                    </td>

                                </tr>
                            `
                        }

                    </tbody>

                </table>

            </div>

        `;

    }

],


/* =========================================================
   1. PATIENTS
   ========================================================= */

[
    'Patients',

    el => {

        const V =
            CMS.V;


        const render =
            () =>
                CMS.mods
                    .RECEPTIONIST[1][1](el);


        CMS.page(

            el,

            {

                title:
                    'Patients',


                /* =================================================
                   REGISTER PATIENT BUTTON
                   ================================================= */

                btn: [

                    '+ Register patient',

                    () => {

                        CMS.form(

                            'Register New Patient',

                            [

                                {
                                    n:
                                        'name',

                                    l:
                                        'Full name',

                                    v:
                                        V.name
                                },


                                {
                                    n:
                                        'phone',

                                    l:
                                        'Phone',

                                    v:
                                        V.phone,

                                    a:
                                        'inputmode="numeric" maxlength="10"'
                                },


                                {
                                    n:
                                        'email',

                                    l:
                                        'Email',

                                    t:
                                        'email',

                                    opt:
                                        1,

                                    v:
                                        V.email
                                },


                                {
                                    n:
                                        'dob',

                                    l:
                                        'Date of birth',

                                    t:
                                        'date',

                                    v:
                                        V.dob,

                                    a:
                                        `max="${CMS.today()}"`
                                },


                                {
                                    n:
                                        'gender',

                                    l:
                                        'Gender',

                                    t:
                                        'select',

                                    o:
                                        [
                                            'Female',
                                            'Male',
                                            'Other'
                                        ]
                                },


                                {
                                    n:
                                        'blood',

                                    l:
                                        'Blood group',

                                    t:
                                        'select',

                                    o:
                                        [
                                            'A+',
                                            'A-',
                                            'B+',
                                            'B-',
                                            'AB+',
                                            'AB-',
                                            'O+',
                                            'O-'
                                        ]
                                },


                                {
                                    n:
                                        'address',

                                    l:
                                        'Address',

                                    t:
                                        'textarea'
                                },


                                {
                                    n:
                                        'emergency',

                                    l:
                                        'Emergency contact phone',

                                    v:
                                        [
                                            V.phone,
                                            V.notPhone
                                        ],

                                    a:
                                        'inputmode="numeric" maxlength="10"'
                                },


                                {
                                    n:
                                        'allergies',

                                    l:
                                        'Allergies',

                                    opt:
                                        1
                                }

                            ],


                            value => {

                                CMS.tx(() => {

                                    /* =================================================
                                       CHECK EXISTING PATIENT
                                       ================================================= */

                                    const existing =
                                        R.findExistingPatient(
                                            value.phone
                                        );


                                    if (existing) {

                                        throw Error(
                                            `Patient already exists with Patient ID ${existing.id}`
                                        );

                                    }


                                    /* =================================================
                                       CREATE NEW PATIENT
                                       ================================================= */

                                    const patient =
                                        CMS.add(

                                            'patients',

                                            {

                                                ...value,

                                                registered:
                                                    CMS.today(),

                                                is_active:
                                                    true

                                            },

                                            'P'

                                        );


                                    /* =================================================
                                       REGISTRATION BILL
                                       ================================================= */

                                    CMS.add(

                                        'bills',

                                        {

                                            patient:
                                                patient.id,

                                            items:
                                                [

                                                    {

                                                        desc:
                                                            'Registration fee',

                                                        amount:
                                                            RECEPTION_FEES.registration,

                                                        ref:
                                                            patient.id,

                                                        refType:
                                                            'REGISTRATION'

                                                    }

                                                ],

                                            paid:
                                                0,

                                            payment_method:
                                                '',

                                            date:
                                                CMS.today()

                                        },

                                        'B'

                                    );

                                });


                                CMS.toast(
                                    'New patient registered successfully. Registration fee generated.'
                                );

                            },


                            render

                        );

                    }

                ],


                /* =================================================
                   PATIENT TABLE
                   ================================================= */

                cols: [

                    [
                        'ID',

                        p =>
                            p.id
                    ],


                    [
                        'Name',

                        p =>
                            `<strong>${CMS.esc(
                                p.name
                            )}</strong>`,

                        1
                    ],


                    [
                        'Phone',

                        p =>
                            CMS.esc(
                                p.phone
                            )
                    ],


                    [
                        'DOB',

                        p =>
                            CMS.esc(
                                p.dob
                            )
                    ],


                    [
                        'Gender',

                        p =>
                            CMS.esc(
                                p.gender
                            )
                    ],


                    [
                        'Blood',

                        p =>
                            `<span class="badge">
                                ${CMS.esc(
                                    p.blood
                                )}
                            </span>`,

                        1
                    ],


                    [
                        'Allergies',

                        p =>
                            p.allergies

                                ?

                                `<span class="text-warn fs-sm">
                                    ${CMS.esc(
                                        p.allergies
                                    )}
                                </span>`

                                :

                                `<span class="text-mute fs-sm">
                                    None
                                </span>`,

                        1
                    ],


                    /* =================================================
                       EDIT BUTTON
                       ================================================= */

                    [
                        'Action',

                        p =>
                            CMS.btn(
                                'edit',
                                p.id,
                                'Edit'
                            ),

                        1
                    ]

                ],


                rows:
                    [
                        ...R.patients()
                    ].reverse(),


                /* =================================================
                   PATIENT ACTIONS
                   ================================================= */

                on: {

                    edit: id => {

                        const patient =
                            R.patient(id);


                        if (!patient) {

                            CMS.toast(
                                'Patient not found',
                                false
                            );

                            return;
                        }


                        R.editPatient(
                            patient,
                            render
                        );

                    }

                }

            }

        );

    }

],


/* =========================================================
   2. APPOINTMENTS
   ========================================================= */

[
    'Appointments',

    el => {

        const V =
            CMS.V;


        const render =
            () =>
                CMS.mods
                    .RECEPTIONIST[2][1](el);


        CMS.page(

            el,

            {

                title:
                    'Appointments',


                btn: [

                    '+ Book appointment',

                    () => {

                        const activePatients =
                            R.activePatients();


                        const doctors =
                            R.doctors();


                        if (
                            !activePatients.length
                        ) {

                            CMS.toast(
                                'Register a patient first.',
                                false
                            );

                            return;
                        }


                        if (
                            !doctors.length
                        ) {

                            CMS.toast(
                                'No active doctors available.',
                                false
                            );

                            return;
                        }


                        CMS.form(

                            'Book Appointment',

                            [

                                {
                                    n:
                                        'patient',

                                    l:
                                        'Patient',

                                    t:
                                        'select',

                                    o:
                                        activePatients.map(
                                            patient => [
                                                patient.id,
                                                `${patient.name} (${patient.id})`
                                            ]
                                        )
                                },


                                {
                                    n:
                                        'doctor',

                                    l:
                                        'Doctor',

                                    t:
                                        'select',

                                    o:
                                        doctors.map(
                                            doctor => [
                                                doctor.id,
                                                doctor.name
                                            ]
                                        )
                                },


                                {
                                    n:
                                        'date',

                                    l:
                                        'Date',

                                    t:
                                        'date',

                                    v:
                                        V.future,

                                    a:
                                        `min="${CMS.today()}"`
                                },


                                {
                                    n:
                                        'slot',

                                    l:
                                        'Time slot',

                                    t:
                                        'select',

                                    o:
                                        CMS.S.slots
                                }

                            ],


                            value => {

                                CMS.tx(() => {

                                    const patient =
                                        CMS.get(
                                            'patients',
                                            value.patient
                                        );


                                    const doctor =
                                        CMS.get(
                                            'users',
                                            value.doctor
                                        );


                                    if (
                                        !patient ||
                                        !patient.is_active
                                    ) {

                                        throw Error(
                                            'Patient is not active'
                                        );

                                    }


                                    if (
                                        !doctor ||
                                        !doctor.is_active
                                    ) {

                                        throw Error(
                                            'Doctor is not available'
                                        );

                                    }


                                    /* =================================================
                                       PREVENT APPOINTMENT IN THE PAST
                                       ================================================= */

                                    const selectedDateTime =
                                        new Date(
                                            `${value.date}T${value.slot}`
                                        );


                                    const now =
                                        new Date();


                                    if (
                                        Number.isNaN(
                                            selectedDateTime.getTime()
                                        )
                                    ) {

                                        throw Error(
                                            'Invalid appointment date or time.'
                                        );

                                    }


                                    if (
                                        selectedDateTime <= now
                                    ) {

                                        throw Error(
                                            'This appointment time has already passed. Please select a future time.'
                                        );

                                    }


                                    /* =================================================
                                       PREVENT SAME PATIENT +
                                       SAME DATE + SAME SLOT
                                       ================================================= */

                                    const patientAlreadyBooked =
                                        R.appointments().some(
                                            appointment =>

                                                appointment.status ===
                                                    'SCHEDULED' &&

                                                appointment.patient ===
                                                    value.patient &&

                                                appointment.date ===
                                                    value.date &&

                                                appointment.slot ===
                                                    value.slot
                                        );


                                    if (
                                        patientAlreadyBooked
                                    ) {

                                        throw Error(
                                            'This patient already has an appointment at this time.'
                                        );

                                    }


                                    /* =================================================
                                       PREVENT DOCTOR +
                                       SAME DATE + SAME SLOT
                                       ================================================= */

                                    const doctorAlreadyBooked =
                                        R.appointments().some(
                                            appointment =>

                                                appointment.status ===
                                                    'SCHEDULED' &&

                                                appointment.doctor ===
                                                    value.doctor &&

                                                appointment.date ===
                                                    value.date &&

                                                appointment.slot ===
                                                    value.slot
                                        );


                                    if (
                                        doctorAlreadyBooked
                                    ) {

                                        throw Error(
                                            'Doctor is already booked at this time.'
                                        );

                                    }


                                    /* =================================================
                                       CREATE APPOINTMENT
                                       ================================================= */

                                    const appointment =
                                        CMS.add(

                                            'appointments',

                                            {

                                                patient:
                                                    value.patient,

                                                doctor:
                                                    value.doctor,

                                                date:
                                                    value.date,

                                                slot:
                                                    value.slot,

                                                status:
                                                    'SCHEDULED',

                                                token_number:
                                                    null,

                                                payment_status:
                                                    'UNPAID'

                                            },

                                            'A'

                                        );


                                    /* =================================================
                                       CONSULTATION BILL
                                       ================================================= */

                                    CMS.add(

                                        'bills',

                                        {

                                            patient:
                                                value.patient,

                                            items:
                                                [

                                                    {

                                                        desc:
                                                            'Consultation fee',

                                                        amount:
                                                            RECEPTION_FEES.consultation,

                                                        ref:
                                                            appointment.id,

                                                        refType:
                                                            'CONSULTATION'

                                                    }

                                                ],

                                            paid:
                                                0,

                                            payment_method:
                                                '',

                                            date:
                                                CMS.today()

                                        },

                                        'B'

                                    );

                                });


                                CMS.toast(
                                    `Appointment booked. Consultation fee: ${R.money(
                                        RECEPTION_FEES.consultation
                                    )}`
                                );

                            },


                            render

                        );

                    }

                ],


                /* =================================================
                   APPOINTMENT TABLE
                   ================================================= */

                cols: [

                    [
                        'Token',

                        appointment =>

                            appointment.token_number

                                ?

                                `<strong>
                                    ${String(
                                        appointment.token_number
                                    ).padStart(
                                        2,
                                        '0'
                                    )}
                                </strong>`

                                :

                                `<span class="text-mute">
                                    Pending
                                </span>`,

                        1
                    ],


                    [
                        'ID',

                        appointment =>
                            appointment.id
                    ],


                    [
                        'Date',

                        appointment =>
                            `<span class="fw-600">
                                ${CMS.esc(
                                    appointment.date
                                )}
                            </span>`,

                        1
                    ],


                    [
                        'Time',

                        appointment =>
                            `<span class="text-acc fw-600">
                                ${CMS.esc(
                                    appointment.slot
                                )}
                            </span>`,

                        1
                    ],


                    [
                        'Patient',

                        appointment =>
                            CMS.esc(
                                R.patientName(
                                    appointment.patient
                                )
                            )
                    ],


                    [
                        'Doctor',

                        appointment =>
                            CMS.esc(
                                R.doctorName(
                                    appointment.doctor
                                )
                            )
                    ],


                    [
                        'Payment',

                        appointment => {

                            const bill =
                                R.appointmentBill(
                                    appointment.id
                                );


                            return CMS.badge(
                                bill
                                    ? R.billStatus(
                                        bill
                                    )
                                    : 'UNPAID'
                            );

                        },

                        1
                    ],


                    [
                        'Status',

                        appointment =>
                            CMS.badge(
                                appointment.status
                            ),

                        1
                    ],


                    [
                        'Action',

                        appointment =>

                            appointment.status ===
                                'SCHEDULED'

                                ?

                                CMS.btn(
                                    'cancel',
                                    appointment.id,
                                    'Cancel',
                                    'bad'
                                )

                                :

                                '',

                        1
                    ]

                ],


                rows:
                    [
                        ...R.appointments()
                    ].reverse(),


                /* =================================================
                   APPOINTMENT ACTIONS
                   ================================================= */

                on: {

                    cancel: id => {

                        if (
                            !confirm(
                                'Cancel this appointment?'
                            )
                        ) {

                            return;

                        }


                        try {

                            CMS.S.cancel(
                                id
                            );


                            CMS.toast(
                                'Appointment cancelled'
                            );


                            render();

                        }

                        catch (
                            error
                        ) {

                            CMS.toast(
                                error.message,
                                false
                            );

                        }

                    }

                }

            }

        );

    }

],


/* =========================================================
   3. BILLING
   ========================================================= */

[
    'Billing',

    el => {

        const render =
            () =>
                CMS.mods
                    .RECEPTIONIST[3][1](el);


        /* =====================================================
           PAYMENT PROGRESS BAR
           ===================================================== */

        const progressBar =
            bill => {

                const total =
                    R.billTotal(
                        bill
                    );


                const paid =
                    Number(
                        bill.paid || 0
                    );


                const percentage =
                    total > 0

                        ?

                        Math.min(
                            100,
                            Math.round(
                                paid /
                                total *
                                100
                            )
                        )

                        :

                        0;


                return `

                    <div style="
                        display:flex;
                        align-items:center;
                        gap:8px;
                        min-width:120px;
                    ">

                        <div style="
                            flex:1;
                            height:6px;
                            background:var(--line);
                            border-radius:99px;
                            overflow:hidden;
                        ">

                            <div style="
                                width:${percentage}%;
                                height:100%;
                                background:${
                                    percentage >= 100
                                        ? 'var(--good)'
                                        :
                                    percentage > 0
                                        ? 'var(--warn)'
                                        :
                                        'var(--bad)'
                                };
                                border-radius:99px;
                            "></div>

                        </div>


                        <span class="fs-sm text-mute">
                            ${percentage}%
                        </span>

                    </div>

                `;

            };


        CMS.page(

            el,

            {

                title:
                    'Billing',


                /* =================================================
                   BILLING TABLE
                   ================================================= */

                cols: [

                    [
                        'Bill',

                        bill =>
                            bill.id
                    ],


                    [
                        'Patient',

                        bill =>
                            CMS.esc(
                                R.patientName(
                                    bill.patient
                                )
                            )
                    ],


                    [
                        'Charges',

                        bill => {

                            if (
                                !bill.items ||
                                !bill.items.length
                            ) {

                                return '—';

                            }


                            return bill.items
                                .map(
                                    item =>
                                        `${CMS.esc(
                                            item.desc
                                        )} (${R.money(
                                            item.amount
                                        )})`
                                )
                                .join(', ');

                        },

                        1
                    ],


                    [
                        'Total',

                        bill =>
                            R.money(
                                R.billTotal(
                                    bill
                                )
                            )
                    ],


                    [
                        'Paid',

                        bill =>
                            R.money(
                                bill.paid
                            )
                    ],


                    [
                        'Due',

                        bill => {

                            const due =
                                R.billDue(
                                    bill
                                );


                            return due > 0

                                ?

                                `<span class="text-bad fw-600">
                                    ${R.money(due)}
                                </span>`

                                :

                                `<span class="text-good fw-600">
                                    ₹ 0
                                </span>`;

                        },

                        1
                    ],


                    [
                        'Progress',

                        bill =>
                            progressBar(
                                bill
                            ),

                        1
                    ],


                    [
                        'Payment',

                        bill =>
                            CMS.badge(
                                R.billStatus(
                                    bill
                                )
                            ),

                        1
                    ],


                    [
                        'Method',

                        bill =>

                            bill.payment_method

                                ?

                                CMS.esc(
                                    bill.payment_method
                                )

                                :

                                '<span class="text-mute">—</span>',

                        1
                    ],


                    [
                        'Token',

                        bill => {

                            const appointmentItem =
                                bill.items.find(
                                    item =>
                                        item.refType ===
                                        'CONSULTATION'
                                );


                            if (
                                !appointmentItem
                            ) {

                                return `
                                    <span class="text-mute">
                                        —
                                    </span>
                                `;

                            }


                            const appointment =
                                CMS.get(
                                    'appointments',
                                    appointmentItem.ref
                                );


                            return (

                                appointment &&
                                appointment.token_number

                            )

                                ?

                                `<strong>
                                    ${String(
                                        appointment.token_number
                                    ).padStart(
                                        2,
                                        '0'
                                    )}
                                </strong>`

                                :

                                `<span class="text-mute">
                                    Pending
                                </span>`;

                        },

                        1
                    ],


                    [
                        'Action',

                        bill =>

                            R.billDue(
                                bill
                            ) > 0

                                ?

                                CMS.btn(
                                    'pay',
                                    bill.id,
                                    'Record payment'
                                )

                                :

                                '',

                        1
                    ]

                ],


                rows:
                    [
                        ...R.bills()
                    ].reverse(),


                /* =================================================
                   BILLING ACTIONS
                   ================================================= */

                on: {

                    pay: id => {

                        const bill =
                            R.bill(
                                id
                            );


                        if (!bill) {

                            CMS.toast(
                                'Bill not found',
                                false
                            );

                            return;

                        }


                        const due =
                            R.billDue(
                                bill
                            );


                        CMS.form(

                            'Record Payment',

                            [

                                {
                                    n:
                                        'amount',

                                    l:
                                        `Amount (Due: ${R.money(due)})`,

                                    v:
                                        CMS.V.money,

                                    a:
                                        'inputmode="decimal"'
                                },


                                {
                                    n:
                                        'method',

                                    l:
                                        'Payment method',

                                    t:
                                        'select',

                                    o:
                                        [

                                            [
                                                'CASH',
                                                'Cash'
                                            ],

                                            [
                                                'CARD',
                                                'Card'
                                            ],

                                            [
                                                'UPI',
                                                'UPI'
                                            ]

                                        ]
                                }

                            ],


                            value => {

                                try {

                                    const updated =
                                        R.completePayment(
                                            id,
                                            value.amount,
                                            value.method
                                        );


                                    const status =
                                        R.billStatus(
                                            updated
                                        );


                                    if (
                                        status ===
                                        'PAID'
                                    ) {

                                        const consultationItem =
                                            updated.items.find(
                                                item =>
                                                    item.refType ===
                                                    'CONSULTATION'
                                            );


                                        if (
                                            consultationItem
                                        ) {

                                            const appointment =
                                                CMS.get(
                                                    'appointments',
                                                    consultationItem.ref
                                                );


                                            if (
                                                appointment &&
                                                appointment.token_number
                                            ) {

                                                CMS.toast(
                                                    `Payment completed. Token ${String(
                                                        appointment.token_number
                                                    ).padStart(
                                                        2,
                                                        '0'
                                                    )} generated.`
                                                );

                                            }

                                            else {

                                                CMS.toast(
                                                    'Payment completed successfully.'
                                                );

                                            }

                                        }

                                        else {

                                            CMS.toast(
                                                'Payment completed successfully.'
                                            );

                                        }

                                    }

                                    else {

                                        CMS.toast(
                                            `Payment recorded. Balance due: ${R.money(
                                                R.billDue(
                                                    updated
                                                )
                                            )}`
                                        );

                                    }

                                }

                                catch (error) {

                                    CMS.toast(
                                        error.message,
                                        false
                                    );

                                }

                            },


                            render

                        );

                    }

                }

            }

        );

    }

]

];