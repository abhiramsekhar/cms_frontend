CMS.mods.DOCTOR = [
    ['My appointments', el => {
        const S = CMS.S, me = CMS.user().id, re = () => CMS.mods.DOCTOR[0][1](el);
        CMS.page(el, {
            title: 'My appointments', cols: [['Date', a => `<span class="fw-600">${CMS.esc(a.date)}</span>`, 1], ['Time', a => `<span class="text-acc fw-600">${CMS.esc(a.slot)}</span>`, 1], ['Patient', a => S.pn(a.patient)],
            ['Allergies', a => { const al = CMS.get('patients', a.patient).allergies; return al ? `<span class="text-bad fw-600">⚠️ ${CMS.esc(al)}</span>` : '<span class="text-mute">None</span>' }, 1],
            ['Status', a => CMS.badge(a.status), 1],
            ['', a => a.status === 'SCHEDULED' ? CMS.btn('con', a.id, '🩺 Consult') : a.status === 'COMPLETED' ? CMS.btn('rx', a.id, '💊 Prescribe') + CMS.btn('lab', a.id, '🧪 Lab test') : '', 1]],
            rows: CMS.all('appointments').filter(a => a.doctor === me && a.status !== 'CANCELLED').sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot)),
            on: {
                con: id => CMS.form('Consultation', [{ n: 'diagnosis', l: 'Diagnosis' }, { n: 'notes', l: 'Notes', t: 'textarea', opt: 1 }], v => S.consult(id, v), re),
                rx: id => CMS.form('Prescribe medicine', [{ n: 'medicine', l: 'Medicine', t: 'select', o: CMS.all('medicines').filter(m => m.is_active && m.expiry >= CMS.today()).map(m => [m.id, m.name]) }, { n: 'qty', l: 'Quantity', v: CMS.V.pos, a: 'inputmode="numeric"' }, { n: 'dosage', l: 'Dosage (e.g. 1-0-1 after food)' }], v => S.prescribe(id, v), re),
                lab: id => CMS.form('Order lab test', [{ n: 'test', l: 'Test', t: 'select', o: CMS.all('labCatalog').map(t => [t.id, t.name]) }], v => S.orderLab(id, v), re)
            }
        })
    }],

    ['Orders & results', el => {
        const S = CMS.S, me = CMS.user().id;
        const rows = [...CMS.all('prescriptions').filter(r => r.doctor === me).map(r => ({ t: '💊 Prescription', p: r.patient, d: `${S.mn(r.medicine)} × ${r.qty}, ${r.dosage}`, s: r.status })),
        ...CMS.all('labOrders').filter(o => o.doctor === me).map(o => ({
            t: '🧪 Lab test', p: o.patient, d: S.tn(o.test) + (o.result ? ` — ${o.result}` : ''), s: o.status,
            flag: o.flag || ''
        }))];
        CMS.page(el, {
            title: 'Orders & results', cols: [['Type', r => `<span class="fw-600">${r.t}</span>`, 1], ['Patient', r => S.pn(r.p)], ['Details', r => r.d],
            ['Flag', r => r.flag ? `<span class="badge ${r.flag === 'Normal' ? 'ACTIVE' : 'CANCELLED'}">${CMS.esc(r.flag)}</span>` : '—', 1],
            ['Status', r => CMS.badge(r.s), 1]], rows
        })
    }]];
