CMS.mods.ADMIN = [
    ['Dashboard', el => {
        const S = CMS.S, A = CMS.all, td = CMS.today();
        const c = [
            ['👥', 'Patients', A('patients').length],
            ['📅', 'Today\'s Appointments', A('appointments').filter(a => a.date === td && a.status === 'SCHEDULED').length],
            ['💊', 'Pending Prescriptions', A('prescriptions').filter(r => r.status === 'PENDING').length],
            ['🧪', 'Open Lab Tests', A('labOrders').filter(o => o.status !== 'COMPLETED').length],
            ['⚠️', 'Low / Expired Stock', A('medicines').filter(m => m.is_active && (m.stock < 10 || m.expiry < td)).length],
            ['💰', 'Collected (₹)', A('bills').reduce((s, b) => s + b.paid, 0).toLocaleString('en-IN')],
            ['📊', 'Outstanding (₹)', A('bills').reduce((s, b) => s + S.bal(b), 0).toLocaleString('en-IN')]];
        el.innerHTML = `<div class="head"><h2>Dashboard</h2><div><button class="btn bad" id="rs">🔄 Reset demo data</button></div></div><div class="stats">${c.map((x, i) => `<div class="card" style="animation:slideUp ${0.3 + i * 0.08}s ease-out both"><span class="stat-icon">${x[0]}</span><b>${x[2]}</b>${CMS.esc(x[1])}</div>`).join('')}</div>`;
        document.getElementById('rs').onclick = () => { if (confirm('Erase all data and restore demo data?')) { CMS.reset(); CMS.logout() } }
    }],

    ['Staff & users', el => {
        const V = CMS.V, me = CMS.user().id, re = () => CMS.mods.ADMIN[1][1](el);
        CMS.page(el, {
            title: 'Staff & users', btn: ['+ Add user', () => CMS.form('Add user', [{ n: 'name', l: 'Full name', v: V.name }, { n: 'username', l: 'Username', v: V.user }, { n: 'password', l: 'Password', t: 'password', v: V.pass },
            { n: 'role', l: 'Role', t: 'select', o: ['DOCTOR', 'RECEPTIONIST', 'PHARMACIST', 'LAB_TECH', 'ADMIN'] }],
                v => { if (CMS.all('users').some(u => u.username === v.username)) throw Error('Username already taken'); CMS.tx(() => CMS.add('users', { ...v, is_active: true }, 'U')) }, re)],
            cols: [['ID', u => u.id], ['Name', u => u.name], ['Username', u => u.username], ['Role', u => CMS.badge(u.role), 1], ['Status', u => CMS.badge(u.is_active ? 'ACTIVE' : 'INACTIVE'), 1],
            ['', u => CMS.btn('t', u.id, u.is_active ? 'Deactivate' : 'Activate', 'ghost') + CMS.btn('p', u.id, 'Reset password', 'ghost'), 1]], rows: CMS.all('users'),
            on: {
                t: id => { if (id === me) throw Error('You cannot deactivate your own account'); CMS.tx(() => { const u = CMS.get('users', id); u.is_active = !u.is_active }); re() },
                p: id => CMS.form('Reset password', [{ n: 'pw', l: 'New password', t: 'password', v: V.pass }], v => CMS.tx(() => { CMS.get('users', id).password = v.pw }), re)
            }
        })
    }],

    ['Lab catalog', el => {
        const V = CMS.V, re = () => CMS.mods.ADMIN[2][1](el);
        CMS.page(el, {
            title: 'Lab test catalog', btn: ['+ Add test', () => CMS.form('Add test', [{ n: 'name', l: 'Test name' }, { n: 'price', l: 'Price (₹)', v: V.money }],
                v => { if (CMS.all('labCatalog').some(t => t.name.toLowerCase() === v.name.toLowerCase())) throw Error('Test already exists'); CMS.tx(() => CMS.add('labCatalog', { name: v.name, price: +v.price }, 'T')) }, re)],
            cols: [['ID', t => t.id], ['Test', t => t.name], ['Price', t => '₹ ' + t.price.toLocaleString('en-IN')], ['', t => CMS.btn('e', t.id, 'Change price', 'ghost'), 1]], rows: CMS.all('labCatalog'),
            on: { e: id => CMS.form('Change price', [{ n: 'price', l: 'New price (₹)', v: V.money }], v => CMS.tx(() => { CMS.get('labCatalog', id).price = +v.price }), re) }
        })
    }]];
