CMS.mods.PHARMACIST = [
    ['Prescription queue', el => {
        const S = CMS.S, re = () => CMS.mods.PHARMACIST[0][1](el);
        CMS.page(el, {
            title: 'Prescription queue', cols: [['Rx', r => r.id], ['Patient', r => S.pn(r.patient)], ['Doctor', r => S.un(r.doctor)],
            ['Medicine', r => `<strong>${CMS.esc(S.mn(r.medicine))}</strong> × ${r.qty}`, 1], ['Dosage', r => r.dosage], ['Status', r => CMS.badge(r.status), 1],
            ['', r => r.status === 'PENDING' ? CMS.btn('d', r.id, '✓ Dispense') : '', 1]], rows: [...CMS.all('prescriptions')].sort((a, b) => (a.status === 'PENDING' ? 0 : 1) - (b.status === 'PENDING' ? 0 : 1)),
            on: { d: id => { S.dispense(id); CMS.toast('Dispensed and billed'); re() } }
        })
    }],

    ['Inventory', el => {
        const V = CMS.V, re = () => CMS.mods.PHARMACIST[1][1](el), td = CMS.today();
        const st = m => !m.is_active ? 'INACTIVE' : m.expiry < td ? 'EXPIRED' : m.stock < 10 ? 'LOW' : 'IN STOCK';
        const stockBar = m => {
            const max = 200, pct = Math.min(m.stock / max * 100, 100);
            return `<div style="display:flex;align-items:center;gap:8px;min-width:100px"><div style="flex:1;height:6px;background:var(--line);border-radius:99px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${m.stock < 10 ? 'var(--bad)' : m.stock < 30 ? 'var(--warn)' : 'var(--good)'};border-radius:99px;transition:width 0.3s"></div></div><span class="fs-sm fw-600">${m.stock}</span></div>`
        };
        CMS.page(el, {
            title: 'Medicine inventory', btn: ['+ Add medicine', () => CMS.form('Add medicine', [{ n: 'name', l: 'Name' }, { n: 'stock', l: 'Opening stock', v: V.pos }, { n: 'price', l: 'Price per unit (₹)', v: V.money }, { n: 'expiry', l: 'Expiry date', t: 'date', v: V.future, a: `min="${CMS.today()}"` }],
                v => { if (CMS.all('medicines').some(m => m.name.toLowerCase() === v.name.toLowerCase())) throw Error('Medicine already exists'); CMS.tx(() => CMS.add('medicines', { name: v.name, stock: +v.stock, price: +v.price, expiry: v.expiry, is_active: true }, 'M')) }, re)],
            cols: [['ID', m => m.id], ['Medicine', m => `<strong>${CMS.esc(m.name)}</strong>`, 1], ['Stock', m => stockBar(m), 1], ['Price', m => '₹ ' + m.price.toLocaleString('en-IN')],
            ['Expiry', m => { const d = m.expiry; return d < td ? `<span class="text-bad fw-600">${CMS.esc(d)}</span>` : `<span>${CMS.esc(d)}</span>` }, 1],
            ['Status', m => CMS.badge(st(m)), 1], ['', m => CMS.btn('r', m.id, '📦 Restock') + CMS.btn('t', m.id, m.is_active ? 'Deactivate' : 'Activate', 'ghost'), 1]], rows: CMS.all('medicines'),
            on: { r: id => CMS.form('Restock', [{ n: 'qty', l: 'Quantity to add', v: V.pos }], v => CMS.tx(() => { CMS.get('medicines', id).stock += +v.qty }), re), t: id => { CMS.tx(() => { const m = CMS.get('medicines', id); m.is_active = !m.is_active }); re() } }
        })
    }]];
