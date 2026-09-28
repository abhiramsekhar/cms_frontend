CMS.mods.RECEPTIONIST = [
    ['Patients', el => {
        const V = CMS.V, re = () => CMS.mods.RECEPTIONIST[0][1](el);
        CMS.page(el, {
            title: 'Patients', btn: ['+ Register patient', () => CMS.form('Register patient', [
                { n: 'name', l: 'Full name', v: V.name }, { n: 'phone', l: 'Phone', v: V.phone, a: 'inputmode="numeric" maxlength="10"' }, { n: 'email', l: 'Email', t: 'email', opt: 1, v: V.email },
                { n: 'dob', l: 'Date of birth', t: 'date', v: V.dob, a: `max="${CMS.today()}"` }, { n: 'gender', l: 'Gender', t: 'select', o: ['Female', 'Male', 'Other'] },
                { n: 'blood', l: 'Blood group', t: 'select', o: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] }, { n: 'address', l: 'Address', t: 'textarea' },
                { n: 'emergency', l: 'Emergency contact phone', v: [V.phone, V.notPhone], a: 'maxlength="10"' }, { n: 'allergies', l: 'Allergies', opt: 1 }], CMS.S.addPatient, re)],
            cols: [['ID', p => p.id], ['Name', p => `<strong>${CMS.esc(p.name)}</strong>`, 1], ['Phone', p => p.phone], ['DOB', p => p.dob], ['Blood', p => `<span class="badge">${CMS.esc(p.blood)}</span>`, 1], ['Allergies', p => p.allergies ? `<span class="text-warn fs-sm">${CMS.esc(p.allergies)}</span>` : '<span class="text-mute fs-sm">None</span>', 1]], rows: CMS.all('patients')
        })
    }],

    ['Appointments', el => {
        const V = CMS.V, S = CMS.S, re = () => CMS.mods.RECEPTIONIST[1][1](el);
        CMS.page(el, {
            title: 'Appointments', btn: ['+ Book appointment', () => CMS.form('Book appointment', [
                { n: 'patient', l: 'Patient', t: 'select', o: CMS.all('patients').filter(p => p.is_active).map(p => [p.id, `${p.name} (${p.id})`]) },
                { n: 'doctor', l: 'Doctor', t: 'select', o: S.doctors().map(d => [d.id, d.name]) }, { n: 'date', l: 'Date', t: 'date', v: V.future, a: `min="${CMS.today()}"` },
                { n: 'slot', l: 'Time slot', t: 'select', o: S.slots }], S.book, re)],
            cols: [['ID', a => a.id], ['Date', a => `<span class="fw-600">${CMS.esc(a.date)}</span>`, 1], ['Time', a => `<span class="text-acc fw-600">${CMS.esc(a.slot)}</span>`, 1], ['Patient', a => S.pn(a.patient)], ['Doctor', a => S.un(a.doctor)], ['Status', a => CMS.badge(a.status), 1],
            ['', a => a.status === 'SCHEDULED' ? CMS.btn('c', a.id, 'Cancel', 'bad') : '', 1]],
            rows: [...CMS.all('appointments')].reverse(), on: { c: id => { if (confirm('Cancel this appointment?')) { S.cancel(id); CMS.toast('Cancelled'); re() } } }
        })
    }],

    ['Billing', el => {
        const S = CMS.S, re = () => CMS.mods.RECEPTIONIST[2][1](el);
        const pBar = (b) => {
            const t = S.total(b), p = b.paid, pct = t > 0 ? Math.round(p / t * 100) : 0;
            return `<div style="display:flex;align-items:center;gap:8px;min-width:120px"><div style="flex:1;height:6px;background:var(--line);border-radius:99px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${pct >= 100 ? 'var(--good)' : pct > 0 ? 'var(--warn)' : 'var(--bad)'};border-radius:99px;transition:width 0.3s"></div></div><span class="fs-sm text-mute">${pct}%</span></div>`
        };
        CMS.page(el, {
            title: 'Billing', cols: [['Bill', b => b.id], ['Patient', b => S.pn(b.patient)], ['Items', b => b.items.map(i => i.desc).join(', ')], ['Total', b => '₹ ' + S.total(b).toLocaleString('en-IN')], ['Paid', b => '₹ ' + b.paid.toLocaleString('en-IN')], ['Due', b => { const d = S.bal(b); return d > 0 ? `<span class="text-bad fw-600">₹ ${d.toLocaleString('en-IN')}</span>` : `<span class="text-good fw-600">₹ 0</span>` }, 1],
            ['Progress', b => pBar(b), 1], ['Status', b => CMS.badge(S.bstat(b)), 1], ['', b => S.bal(b) > 0 ? CMS.btn('p', b.id, 'Record payment') : '', 1]], rows: [...CMS.all('bills')].reverse(),
            on: { p: id => CMS.form('Record payment', [{ n: 'amt', l: 'Amount (₹)', v: CMS.V.money, a: 'inputmode="decimal"' }], v => S.pay(id, v.amt), re) }
        })
    }]];
