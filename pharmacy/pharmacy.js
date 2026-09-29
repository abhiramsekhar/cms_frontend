/* pharmacy/pharmacy.js — Pharmacist module (dashboard, prescriptions, inventory, suppliers, purchases, alerts, bills) */
window.PH_UI_VERSION = 'pharmacy-1790670000';
(() => {
    const esc = s => CMS.esc(String(s ?? ''));
    const money = n => '₹ ' + Number(n || 0).toLocaleString('en-IN');
    const num = x => (x === '' || x == null) ? NaN : Number(x);
    const safe = (f, fb) => { try { return f() ?? fb } catch (e) { return fb } };
    const slug = n => n.toLowerCase().replace(/ /g, '-') + '.html';

    /* ---------- theme-matched helpers ---------- */
    const surface = () => {
        let n = document.querySelector('table') || document.querySelector('#app');
        while (n) { const c = getComputedStyle(n).backgroundColor; if (c && c !== 'transparent' && !/,\s*0\)$/.test(c)) return c; n = n.parentElement }
        return '#fff';
    };
    const mkBtn = (label, ghost) => {
        try {
            const t = document.createElement('template'); t.innerHTML = CMS.btn('__ph', '', label, ghost ? 'ghost' : undefined).trim();
            const b = t.content.firstElementChild;
            if (b) { [...b.attributes].filter(a => a.name.startsWith('data-')).forEach(a => b.removeAttribute(a.name)); b.type = 'button'; return b }
        } catch (e) { }
        const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
        b.style.cssText = 'padding:9px 16px;border-radius:10px;border:1px solid var(--line,#ccc);cursor:pointer;background:' + (ghost ? 'transparent' : '#0f766e') + ';color:' + (ghost ? 'inherit' : '#fff');
        return b;
    };

    /* generic modal form. field: {n,l,t:text|number|date|select|textarea|lines,o,req,full,min,step,ph,cols} */
    function dialog({ title, fields, init = {}, save = 'Save', cancelLabel = 'Cancel', note, onSave, hook }) {
        const bg = surface(), line = 'var(--line,rgba(128,128,128,.35))';
        const IN = `width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid ${line};border-radius:10px;background:${bg};color:inherit;font:inherit;outline:none`;
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px';
        const opts = (o, val) => o.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(val ?? '') ? ' selected' : ''}>${esc(l)}</option>`).join('');
        const ctl = (f, val, attr) => f.t === 'select' ? `<select ${attr} style="${IN}">${opts(f.o, val)}</select>`
            : f.t === 'textarea' ? `<textarea ${attr} rows="2" style="${IN};resize:vertical">${esc(val)}</textarea>`
                : `<input ${attr} type="${f.t || 'text'}" value="${esc(val)}" ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.step ? `step="${f.step}"` : ''} ${f.ph ? `placeholder="${esc(f.ph)}"` : ''} style="${IN}">`;
        const grid = f => f.cols.map(c => c.w || '1fr').join(' ') + ' 28px';
        const row = (f, v) => `<div data-row style="display:grid;grid-template-columns:${grid(f)};gap:8px;margin-bottom:8px">${f.cols.map(c => ctl(c, v[c.n], `data-c="${c.n}"`)).join('')}<button type="button" data-rm title="Remove" style="border:0;background:transparent;color:var(--bad,#c0392b);font-size:16px;cursor:pointer">✕</button></div>`;
        const lab = t => `<div style="font-size:12px;font-weight:600;opacity:.7;margin-bottom:5px">${esc(t)}</div>`;
        const block = f => `<div style="${f.full || f.t === 'lines' ? 'grid-column:1/-1' : ''}">` + (f.t === 'lines'
            ? `${lab(f.l)}<div style="display:grid;grid-template-columns:${grid(f)};gap:8px;font-size:11px;opacity:.6;margin-bottom:4px">${f.cols.map(c => `<span>${esc(c.l)}</span>`).join('')}<span></span></div><div data-lines="${f.n}">${(init[f.n] || [{}]).map(v => row(f, v)).join('')}</div><a href="#" data-add="${f.n}" style="font-size:13px;font-weight:600;color:var(--brand,#0f766e);text-decoration:none">+ Add line</a>`
            : `${lab(f.l + (f.req ? ' *' : ''))}${ctl(f, init[f.n], `name="${f.n}"`)}`) + '</div>';
        ov.innerHTML = `<div style="background:${bg};color:inherit;border:1px solid ${line};border-radius:18px;width:100%;max-width:560px;max-height:92vh;overflow:auto;padding:24px 26px;box-shadow:0 24px 60px rgba(0,0,0,.35)"><h3 style="margin:0 0 18px;font:800 20px 'Plus Jakarta Sans',sans-serif">${esc(title)}</h3><div data-body style="display:grid;grid-template-columns:1fr 1fr;gap:14px">${fields.map(block).join('')}</div><div data-note style="margin-top:14px;font-size:13px"></div><div data-err style="margin-top:10px;font-size:13px;font-weight:600;color:var(--bad,#c0392b)"></div><div data-foot style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px"></div></div>`;
        const $ = q => ov.querySelector(q);
        const read = () => {
            const v = {};
            fields.forEach(f => {
                if (f.t === 'lines') v[f.n] = [...ov.querySelectorAll(`[data-lines="${f.n}"] [data-row]`)].map(r => { const o = {}; r.querySelectorAll('[data-c]').forEach(i => o[i.dataset.c] = i.value.trim()); return o });
                else v[f.n] = ov.querySelector(`[name="${f.n}"]`).value.trim();
            });
            return v;
        };
        const refresh = () => { $('[data-note]').innerHTML = note ? safe(() => note(read()), '') : '' };
        const close = () => { document.removeEventListener('keydown', esc_); ov.remove() };
        const esc_ = e => { if (e.key === 'Escape') close() };
        const cancel = mkBtn(cancelLabel, true), ok = save === null ? null : mkBtn(save);
        cancel.onclick = close;
        if (ok) ok.onclick = async () => {
            $('[data-err]').textContent = ''; ok.disabled = true;
            try { await onSave(read()); close() } catch (e) { $('[data-err]').textContent = e.message; ok.disabled = false }
        };
        $('[data-foot]').append(...(ok ? [cancel, ok] : [cancel]));
        ov.addEventListener('click', e => {
            const add = e.target.closest('[data-add]'), rm = e.target.closest('[data-rm]');
            if (add) { e.preventDefault(); const f = fields.find(x => x.n === add.dataset.add); const t = document.createElement('div'); t.innerHTML = row(f, {}); ov.querySelector(`[data-lines="${f.n}"]`).append(t.firstElementChild); refresh() }
            if (rm) { const r = rm.closest('[data-row]'); if (r.parentElement.children.length > 1) { r.remove(); refresh() } }
        });
        ov.addEventListener('input', refresh); ov.addEventListener('change', refresh);
        document.addEventListener('keydown', esc_);
        document.body.append(ov); refresh(); if (hook) hook(ov, close);
        const first = ov.querySelector('input,select,textarea'); if (first) first.focus();
    }

    /* ---------- validation / payload builders ---------- */
    const CATS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Other'];
    function medFields(isNew, cat) {
        const cats = [...CATS]; if (cat && !cats.includes(cat)) cats.push(cat);
        return [
            { n: 'name', l: 'Medicine name', req: 1, full: 1, ph: 'e.g. Paracetamol' },
            { n: 'generic_name', l: 'Generic name' }, { n: 'manufacturer', l: 'Manufacturer' },
            { n: 'category', l: 'Category', t: 'select', o: [['', '— select —'], ...cats.map(c => [c, c])] },
            { n: 'reorder_threshold', l: 'Reorder level', t: 'number', min: 0, step: 1 },
            { n: 'max_stock_level', l: 'Max stock level', t: 'number', min: 0, step: 1, ph: 'default ' + PH.DEFAULT_MAX_STOCK },
            { n: 'cost_price', l: 'Cost price (₹)', t: 'number', min: 0, step: '0.01' },
            { n: 'selling_price', l: 'Selling price (₹)', t: 'number', min: 0, step: '0.01', req: 1 },
            ...(isNew ? [{ n: 'stock_quantity', l: 'Opening stock', t: 'number', min: 0, step: 1 }] : []),
            { n: 'expiry_date', l: 'Expiry date', t: 'date', min: isNew ? CMS.today() : undefined }];
    }
    function medBody(v, self, meds) {
        const name = v.name.trim(), mk = (v.manufacturer || '').trim();
        if (!/^[A-Za-z][A-Za-z \-]{2,}$/.test(name)) throw Error('Name must be at least 3 characters: letters, spaces or hyphens only');
        if (meds.some(m => (!self || m.id !== self.id) && m.name.toLowerCase() === name.toLowerCase() && (m.maker || '').toLowerCase() === mk.toLowerCase()))
            throw Error('A medicine with the same name and manufacturer already exists');
        const cost = v.cost_price === '' ? 0 : num(v.cost_price), sell = num(v.selling_price), th = v.reorder_threshold === '' ? 10 : num(v.reorder_threshold);
        if (!(sell >= 0)) throw Error('Enter a valid selling price');
        if (!(cost >= 0)) throw Error('Cost price cannot be negative');
        if (sell < cost) throw Error('Selling price cannot be lower than cost price');
        if (!Number.isInteger(th) || th < 0) throw Error('Reorder level must be a whole number (0 or more)');
        let maxStock = PH.DEFAULT_MAX_STOCK;
        if (v.max_stock_level !== '' && v.max_stock_level != null) {
            maxStock = num(v.max_stock_level);
            if (!Number.isInteger(maxStock) || maxStock < 0) throw Error('Max stock level must be a whole number (0 or more)');
            if (maxStock < th) throw Error('Max stock level cannot be lower than the reorder level');
        }
        const b = {
            name, generic_name: v.generic_name || null, manufacturer: mk || null, category: v.category || null,
            cost_price: cost.toFixed(2), selling_price: sell.toFixed(2), reorder_threshold: th, max_stock_level: maxStock, expiry_date: v.expiry_date || null
        };
        if (!self) {
            const st = v.stock_quantity === '' ? 0 : num(v.stock_quantity);
            if (!Number.isInteger(st) || st < 0) throw Error('Opening stock must be a whole number (0 or more)');
            if (b.expiry_date && b.expiry_date < CMS.today()) throw Error('Expiry date cannot be in the past');
            if (st > maxStock) throw Error(`Opening stock cannot exceed the max stock level (${maxStock})`);
            b.stock_quantity = st;
        }
        return b;
    }
    const supFields = [
        { n: 'name', l: 'Supplier name', req: 1, full: 1 }, { n: 'contact_person', l: 'Contact person' }, { n: 'phone', l: 'Phone', ph: '+919876543210' },
        { n: 'email', l: 'Email', full: 1 }, { n: 'address', l: 'Address', t: 'textarea', full: 1 }];
    function supBody(v) {
        if (v.name.length < 3) throw Error('Supplier name must be at least 3 characters');
        if (v.phone && !/^\+?\d{7,15}$/.test(v.phone)) throw Error('Enter a valid phone number (7-15 digits)');
        if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) throw Error('Enter a valid email address');
        const b = {}; Object.entries(v).forEach(([k, x]) => { b[k] = x === '' ? null : x }); b.name = v.name; return b;
    }
    // shared: validate lines of [{medicine, quantity, unit_cost?}]
    const lineItems = (lines, costed) => {
        const seen = new Set();
        return lines.map((l, i) => {
            const q = num(l.quantity), c = costed ? num(l.unit_cost) : 0;
            if (!l.medicine) throw Error(`Line ${i + 1}: choose a medicine`);
            if (seen.has(l.medicine)) throw Error('The same medicine is listed twice');
            seen.add(l.medicine);
            if (!Number.isInteger(q) || q < 1) throw Error(`Line ${i + 1}: quantity must be a whole number, 1 or more`);
            if (costed && !(c >= 0)) throw Error(`Line ${i + 1}: enter a valid unit cost`);
            return costed ? { medicine: l.medicine, quantity: q, unit_cost: c.toFixed(2) } : { medicine_id: l.medicine, quantity: q };
        });
    };
    const alertsOf = (meds, td) => {
        const soon = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
        return meds.filter(m => m.is_active).map(m => {
            const why = [];
            if (m.expiry && m.expiry < td) why.push('EXPIRED'); else if (m.expiry && m.expiry <= soon) why.push('EXPIRING');
            if (m.stock <= m.threshold) why.push('LOW');
            return { ...m, why };
        }).filter(m => m.why.length);
    };
    const stat = (m, td) => !m.is_active ? 'INACTIVE' : (m.expiry && m.expiry < td) ? 'EXPIRED' : m.stock <= m.threshold ? 'LOW' : 'IN STOCK';
    const restockDlg = (m, done) => {
        const isExpired = m.expiry && m.expiry < CMS.today();
        dialog({
            title: 'Restock — ' + m.name,
            fields: [{ n: 'qty', l: 'Quantity to add', t: 'number', min: 1, step: 1, req: 1 },
            ...(isExpired ? [{ n: 'new_expiry', l: 'Expiry date for this new stock', t: 'date', req: 1, min: CMS.today() }] : [])],
            save: 'Add stock',
            note: v => {
                const limitTxt = m.maxStock != null ? ` <span class="fs-sm">(limit ${m.maxStock})</span>` : '';
                const q = num(v.qty);
                if (!(q >= 1)) return `Current stock: <strong>${m.stock}</strong>${limitTxt}`;
                const proj = PH.projectStock(m, q);
                let warn = '';
                if (proj.discarded) warn += `<div style="color:var(--bad,#c0392b);font-weight:600">⚠ Existing stock is expired — ${proj.discarded} unit${proj.discarded > 1 ? 's' : ''} will be discarded first.</div>`;
                if (proj.capped) warn += `<div style="color:var(--warn,#b45309);font-weight:600">⚠ ${proj.capped} unit${proj.capped > 1 ? 's' : ''} over the limit of ${m.maxStock} will not be added.</div>`;
                return warn + `Stock: <strong>${m.stock}</strong> → <strong>${proj.newStock}</strong>${limitTxt}`;
            },
            onSave: async v => {
                const q = num(v.qty); if (!Number.isInteger(q) || q < 1) throw Error('Enter a whole number of 1 or more');
                if (isExpired) { if (!v.new_expiry) throw Error('Enter the expiry date for this new stock'); if (v.new_expiry < CMS.today()) throw Error('Expiry date cannot be in the past') }
                if (PH.projectStock(m, q).newStock <= (isExpired ? 0 : m.stock)) throw Error(`Stock is already at the limit of ${m.maxStock}`);
                const r = await PH.restock(m.id, q, isExpired ? v.new_expiry : undefined);
                const extra = [];
                if (r.discardedQty) extra.push(`${r.discardedQty} expired unit${r.discardedQty > 1 ? 's' : ''} discarded`);
                if (r.cappedQty) extra.push(`${r.cappedQty} unit${r.cappedQty > 1 ? 's' : ''} over the limit not added`);
                CMS.toast('Stock updated' + (extra.length ? ' — ' + extra.join(', ') : '')); done();
            }
        });
    };

    /* ---------- export / print / delete helpers ---------- */
    const csvCell = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    function exportCSV(name, head, rows) {
        const txt = '\ufeff' + [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
        a.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${CMS.today()}.csv`; document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    function printDoc(title, html) {
        const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.append(f);
        const d = f.contentWindow.document; d.open();
        d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:14px Inter,Arial,sans-serif;color:#111;padding:28px}h1{font-size:22px;margin:0 0 4px}h2{font-size:13px;color:#555;margin:0 0 16px;font-weight:500}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{border:1px solid #bbb;padding:7px 10px;text-align:left;font-size:13px}th{background:#f0f2f5}.r{text-align:right}.meta{margin:2px 0;font-size:13px}.sig{margin-top:60px;display:flex;justify-content:space-between}.sig div{border-top:1px solid #333;padding-top:6px;width:200px;font-size:12px}</style></head><body>${html}</body></html>`);
        d.close(); f.contentWindow.focus();
        setTimeout(() => { f.contentWindow.print(); setTimeout(() => f.remove(), 2000) }, 200);
    }
    const stamp = () => `Printed ${new Date().toLocaleString('en-IN')}`;
    const tableDoc = (title, head, rows) => `<h1>Clinic CMS — ${esc(title)}</h1><h2>${stamp()}</h2><table><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`;
    // adds  ⬇ CSV / 🖨 Print  buttons next to the page title
    function tools(el, name, head, rows) {
        const h = el.querySelector('h1,h2,h3'); if (!h) return;
        const box = document.createElement('span'); box.style.cssText = 'display:inline-flex;gap:8px;margin-left:14px;vertical-align:middle;white-space:nowrap';
        const b1 = mkBtn('⬇ CSV', true), b2 = mkBtn('🖨 Print', true);
        [b1, b2].forEach(b => { b.style.fontSize = '13px'; b.style.fontWeight = '600' });
        b1.onclick = () => exportCSV(name, head, rows); b2.onclick = () => printDoc(name, tableDoc(name, head, rows));
        box.append(b1, b2); h.append(box);
    }
    const confirmDel = (what, extra, fn) => dialog({
        title: 'Delete ' + what + '?', fields: [], save: 'Delete', note: () => `This permanently removes <strong>${esc(what)}</strong>. ${extra || ''}`, onSave: fn
    });

    // best-effort: pick up the logged-in name from a CMS global if one exists, else read it off the sidebar
    function greetName() {
        try { const n = CMS.user?.name || CMS.currentUser?.name || CMS.S?.currentUser?.name || CMS.S?.me?.name; if (n) return String(n).split(' ')[0] } catch (e) { }
        try {
            const all = [...document.querySelectorAll('aside *, nav *, [class*="side"] *, [class*="nav"] *')];
            const roleEl = all.find(e => !e.children.length && /^[A-Z][A-Z ]{2,20}$/.test(e.textContent.trim()));
            if (roleEl) {
                let p = roleEl.parentElement;
                for (let i = 0; i < 3 && p; i++, p = p.parentElement) {
                    const nameEl = [...p.querySelectorAll('*')].find(e => e !== roleEl && !e.children.length && /^[A-Z][a-zA-Z]+( [A-Z][a-zA-Z]+)+$/.test(e.textContent.trim()));
                    if (nameEl) return nameEl.textContent.trim().split(' ')[0];
                }
            }
        } catch (e) { }
        return '';
    }
    function greeting() {
        const h = new Date().getHours(), part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening', name = greetName();
        return `Good ${part}${name ? ', ' + esc(name) : ''}!`;
    }

    let alertsShown = false;   // popup shows once per page load, not on every table refresh
    function alertPopup(al, meds, re) {
        const row = (m, txt, restock) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--line,rgba(128,128,128,.25))"><span><strong>${esc(m.name)}</strong> <span class="fs-sm">${txt}</span></span>${restock ? `<a href="#" data-rs="${esc(m.id)}" style="font-weight:600;font-size:13px;text-decoration:none;white-space:nowrap;color:var(--brand,#0f766e)">📦 Restock</a>` : ''}</div>`;
        const grp = (why, title, color, fn, restock) => { const it = al.filter(m => m.why.includes(why)); return it.length ? `<div style="margin-bottom:14px"><div style="font-weight:700;color:${color};margin-bottom:2px">${title} (${it.length})</div>${it.map(m => row(m, fn(m), restock)).join('')}</div>` : '' };
        const html = grp('EXPIRED', '⛔ Expired', 'var(--bad,#c0392b)', m => `expired on ${esc(m.expiry)} · ${m.stock} in stock — remove or deactivate`, false)
            + grp('EXPIRING', '⏳ Expiring within 30 days', 'var(--warn,#b45309)', m => `expires ${esc(m.expiry)}`, false)
            + grp('LOW', '📉 Low stock', 'var(--warn,#b45309)', m => `${m.stock} left (reorder at ${m.threshold})`, true);
        dialog({
            title: `⚠ ${al.length} medicine${al.length > 1 ? 's need' : ' needs'} attention`, fields: [], save: null, cancelLabel: 'Dismiss', note: () => html,
            hook: (ov, close) => ov.addEventListener('click', e => { const a = e.target.closest('[data-rs]'); if (a) { e.preventDefault(); close(); restockDlg(meds.find(m => m.id === a.dataset.rs), re) } })
        });
    }

    /* ---------- pages ---------- */
    const defs = [];

    defs.push(['Dashboard', async (el, re) => {
        const td = CMS.today();
        const [M, P, U] = await Promise.allSettled([PH.medicines(), PH.prescriptions(), PH.purchases()]);
        const bad = [M, P, U].find(x => x.status === 'rejected'); if (bad) CMS.toast(bad.reason.message);
        const meds = M.value || [], rx = P.value || [], pur = U.value || [];
        const al = alertsOf(meds, td).sort((a, b) => (b.why.includes('EXPIRED') ? 1 : 0) - (a.why.includes('EXPIRED') ? 1 : 0));
        CMS.page(el, {
            title: 'Dashboard', cols: [['Medicine', m => `<strong>${esc(m.name)}</strong>`, 1], ['Stock', m => `${m.stock} <span class="fs-sm">(reorder at ${m.threshold})</span>`, 1],
            ['Expiry', m => esc(m.expiry || '—'), 1], ['Needs attention', m => m.why.map(w => CMS.badge(w)).join(' '), 1]], rows: al
        });
        const bg = surface();
        const tile = (l, v, c, href) => `<a href="${href}" style="text-decoration:none;color:inherit;display:block;background:${bg};border:1px solid var(--line,rgba(128,128,128,.25));border-radius:16px;padding:16px 18px"><div style="font-size:12px;font-weight:600;opacity:.65;text-transform:uppercase;letter-spacing:.04em">${l}</div><div style="font:800 30px 'Plus Jakarta Sans',sans-serif;margin-top:6px;color:${c || 'inherit'}">${v}</div></a>`;
        const greet = document.createElement('div');
        greet.style.cssText = 'font-size:15px;font-weight:600;opacity:.8;margin:-6px 0 16px';
        greet.textContent = greeting();
        const g = document.createElement('div');
        g.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin:0 0 22px';
        g.innerHTML = tile('Active medicines', meds.filter(m => m.is_active).length, '', slug('Inventory'))
            + tile('Low stock', al.filter(m => m.why.includes('LOW')).length, 'var(--warn)', slug('Inventory'))
            + tile('Expired', al.filter(m => m.why.includes('EXPIRED')).length, 'var(--bad)', slug('Inventory'))
            + tile('Expiring in 30 days', al.filter(m => m.why.includes('EXPIRING')).length, 'var(--warn)', slug('Inventory'))
            + tile('Pending prescriptions', rx.filter(r => r.status === 'PENDING').length, 'var(--brand,inherit)', slug('Prescription queue'))
            + tile('Pending purchases', pur.filter(p => p.status === 'PENDING').length, '', slug('Purchases'));
        const h = el.querySelector('h1,h2,h3'), t = el.querySelector('table');
        if (h && t) { let a = h; while (a.parentElement && a.parentElement !== el && !a.parentElement.contains(t)) a = a.parentElement; a.insertAdjacentElement('afterend', greet); greet.insertAdjacentElement('afterend', g) }
        else if (h) { h.insertAdjacentElement('afterend', greet); greet.insertAdjacentElement('afterend', g) } else { el.prepend(g); el.prepend(greet) }
    }]);

    defs.push(['Prescription queue', async (el, re) => {
        const S = CMS.S || {}, td = CMS.today();
        let data = [], meds = [];
        try { data = await PH.prescriptions() } catch (e) { CMS.toast(e.message) }
        try { meds = await PH.medicines() } catch (e) { }
        const rows = data.map(r => ({
            ...r, id: r.prescription_id || r.id,
            _patient: r.patient_name || safe(() => S.pn(r.patient), r.patient),
            _doctor: r.doctor_name || safe(() => S.un(r.doctor), r.doctor),
            _medicine: r.medicine_name || safe(() => S.mn(r.medicine), r.medicine)
        })).sort((a, b) => (a.status === 'PENDING' ? 0 : 1) - (b.status === 'PENDING' ? 0 : 1));
        const dispense = async id => {
            const r = rows.find(x => x.id === id);
            let allMeds = meds, bills = [];
            try { allMeds = await PH.medicines() } catch (e) { }
            const active = allMeds.filter(m => m.is_active);
            try { bills = await PH.bills() } catch (e) { }
            const bid = b => b.bill_id || b.id;
            const open = bills.filter(b => !/PAID|CANCEL/i.test(b.status || '') && (!r.patient || !b.patient || b.patient === r.patient));
            const pre = r.bill_id || r.bill || '';
            const billField = open.length
                ? { n: 'bill', l: 'Add to bill', t: 'select', full: 1, o: [['', '— choose bill —'], ...open.map(b => [bid(b), `${bid(b)} · ${money(b.total_amount)}`])] }
                : { n: 'bill', l: 'Bill ID', full: 1, ph: 'BILL-0001' };
            const src = r.items || [{ medicine_id: r.medicine_id || r.medicine, quantity: r.qty ?? r.quantity }];
            const lines = src.map(i => { const k = i.medicine_id || i.medicine, m = active.find(x => x.id === k || x.name.toLowerCase() === String(k).toLowerCase()); return { medicine: m ? m.id : '', quantity: i.quantity ?? i.qty ?? 1 } });
            dialog({
                title: `Dispense ${id}`, save: '✓ Dispense & bill', init: { bill: pre, lines },
                fields: [billField, { n: 'lines', l: 'Medicines to dispense', t: 'lines', cols: [{ n: 'medicine', l: 'Medicine', t: 'select', o: [['', '— select —'], ...active.map(m => [m.id, m.name])], w: '2fr' }, { n: 'quantity', l: 'Qty', t: 'number', min: 1, step: 1, w: '80px' }] }],
                note: v => {
                    let tot = 0, msg = [];
                    v.lines.forEach(l => {
                        const m = active.find(x => x.id === l.medicine), q = num(l.quantity); if (!m || !(q >= 1)) return;
                        tot += m.price * q;
                        if (m.expiry && m.expiry < td) msg.push(`${esc(m.name)} is expired`);
                        else if (m.stock < q) msg.push(`${esc(m.name)}: only ${m.stock} in stock`);
                    });
                    return (msg.length ? `<div style="color:var(--bad,#c0392b);font-weight:600">⚠ ${msg.join(' · ')}</div>` : '') + `<div>Bill amount: <strong>${money(tot)}</strong></div>`;
                },
                onSave: async v => {
                    if (!v.bill) throw Error('Choose or enter the bill to charge');
                    await PH.dispense(id, v.bill, lineItems(v.lines, false));
                    CMS.toast('Dispensed and billed'); re();
                }
            });
        };
        CMS.page(el, {
            title: 'Prescription queue', cols: [['Rx', r => r.id], ['Patient', r => esc(r._patient)], ['Doctor', r => esc(r._doctor)],
            ['Medicine', r => `<strong>${esc(r._medicine)}</strong> × ${r.qty ?? r.quantity ?? ''}`, 1], ['Dosage', r => esc(r.dosage)], ['Status', r => CMS.badge(r.status), 1],
            ['', r => r.status === 'PENDING' ? CMS.btn('d', r.id, '✓ Dispense') : CMS.btn('pr', r.id, '🖨', 'ghost'), 1]], rows,
            on: {
                d: dispense,
                pr: id => { const r = rows.find(x => x.id === id); printDoc('Dispensing slip ' + id, `<h1>Clinic CMS — Dispensing slip</h1><h2>${stamp()}</h2><p class="meta"><strong>Rx:</strong> ${esc(id)}</p><p class="meta"><strong>Patient:</strong> ${esc(r._patient)}</p><p class="meta"><strong>Doctor:</strong> ${esc(r._doctor)}</p><p class="meta"><strong>Bill:</strong> ${esc(r.bill_id || r.bill || '—')}</p><table><tr><th>Medicine</th><th>Qty</th><th>Dosage</th></tr><tr><td>${esc(r._medicine)}</td><td>${esc(r.qty ?? r.quantity ?? '')}</td><td>${esc(r.dosage)}</td></tr></table><div class="sig"><div>Pharmacist</div><div>Patient</div></div>`) }
            }
        });
        tools(el, 'Prescription queue', ['Rx', 'Patient', 'Doctor', 'Medicine', 'Qty', 'Dosage', 'Status'], rows.map(r => [r.id, r._patient, r._doctor, r._medicine, r.qty ?? r.quantity ?? '', r.dosage ?? '', r.status]));
    }]);

    defs.push(['Inventory', async (el, re) => {
        const td = CMS.today();
        let meds = []; try { meds = await PH.medicines() } catch (e) { CMS.toast(e.message) }
        const run = async fn => { try { await fn() } catch (e) { CMS.toast(e.message) } re() };
        const bar = m => { const capRef = m.maxStock || 200, pct = Math.min(m.stock / capRef * 100, 100), c = m.stock <= m.threshold ? 'var(--bad)' : m.stock < capRef * 0.3 ? 'var(--warn)' : 'var(--good)'; return `<div style="display:flex;align-items:center;gap:8px;min-width:100px"><div style="flex:1;height:6px;background:var(--line);border-radius:99px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${c};border-radius:99px;transition:width 0.3s"></div></div><span class="fs-sm fw-600">${m.stock}${m.maxStock != null ? '/' + m.maxStock : ''}</span></div>` };
        const form = m => dialog({
            title: m ? 'Edit medicine' : 'Add medicine', fields: medFields(!m, m && m.category), save: m ? 'Save changes' : 'Add medicine',
            init: m ? { name: m.name, generic_name: m.generic, manufacturer: m.maker, category: m.category, reorder_threshold: m.threshold, max_stock_level: m.maxStock ?? '', cost_price: m.cost, selling_price: m.price, expiry_date: m.expiry } : { reorder_threshold: 10 },
            onSave: async v => { const b = medBody(v, m, meds); if (m) await PH.updateMedicine(m.id, b); else await PH.addMedicine(b); CMS.toast(m ? 'Medicine updated' : 'Medicine added'); re() }
        });
        CMS.page(el, {
            title: 'Medicine inventory', btn: ['+ Add medicine', () => form()],
            cols: [['ID', m => m.id], ['Medicine', m => `<strong>${esc(m.name)}</strong><div class="fs-sm">${esc([m.generic, m.maker].filter(Boolean).join(' · ') || '—')}</div>`, 1], ['Category', m => esc(m.category || '—')],
            ['Stock', m => bar(m), 1], ['Cost', m => money(m.cost)], ['Price', m => money(m.price)],
            ['Expiry', m => m.expiry && m.expiry < td ? `<span class="text-bad fw-600">${esc(m.expiry)}</span>` : `<span>${esc(m.expiry || '—')}</span>`, 1],
            ['Status', m => CMS.badge(stat(m, td)), 1],
            ['', m => CMS.btn('r', m.id, '📦 Restock') + CMS.btn('e', m.id, 'Edit', 'ghost') + CMS.btn('t', m.id, m.is_active ? 'Deactivate' : 'Activate', 'ghost') + CMS.btn('x', m.id, '🗑', 'ghost'), 1]], rows: meds,
            on: { r: id => restockDlg(meds.find(m => m.id === id), re), e: id => form(meds.find(m => m.id === id)), t: id => run(() => PH.setActive(id, !meds.find(m => m.id === id).is_active)),
                x: id => { const m = meds.find(z => z.id === id); confirmDel(m.name, 'If it is used in purchase orders it cannot be deleted — deactivate it instead.', async () => { await PH.deleteMedicine(id); CMS.toast('Medicine deleted'); re() }) } }
        });
        tools(el, 'Medicine inventory', ['ID', 'Medicine', 'Generic', 'Manufacturer', 'Category', 'Stock', 'Max stock', 'Reorder level', 'Cost', 'Price', 'Expiry', 'Status'],
            meds.map(m => [m.id, m.name, m.generic, m.maker, m.category, m.stock, m.maxStock, m.threshold, m.cost, m.price, m.expiry, stat(m, td)]));
        const al = alertsOf(meds, td);
        if (al.length && !alertsShown) { alertsShown = true; alertPopup(al, meds, re) }
    }]);

    defs.push(['Suppliers', async (el, re) => {
        let rows = [], meds = [];
        const [S, M] = await Promise.allSettled([PH.suppliers(), PH.medicines()]);
        const bad = [S, M].find(x => x.status === 'rejected'); if (bad) CMS.toast(bad.reason.message);
        rows = S.value || []; meds = M.value || [];
        const run = async fn => { try { await fn() } catch (e) { CMS.toast(e.message) } re() };
        const form = s => dialog({
            title: s ? 'Edit supplier' : 'Add supplier', fields: supFields, save: s ? 'Save changes' : 'Add supplier',
            init: s ? { name: s.name, contact_person: s.contact_person || '', phone: s.phone || '', email: s.email || '', address: s.address || '' } : {},
            onSave: async v => { const b = supBody(v); if (s) await PH.updateSupplier(s.id, b); else await PH.addSupplier(b); CMS.toast('Supplier saved'); re() }
        });
        // each supplier's own agreed rate per medicine — used to auto-fill purchase orders
        const priceDlg = async s => {
            let list = []; try { list = await PH.supplierPrices(s.id) } catch (e) { CMS.toast(e.message) }
            dialog({
                title: 'Price list — ' + s.name, save: 'Save price list',
                init: { lines: list.length ? list.map(x => ({ medicine: x.medicine, price: x.price })) : [{}] },
                fields: [{ n: 'lines', l: 'Medicine rates', t: 'lines', cols: [{ n: 'medicine', l: 'Medicine', t: 'select', o: [['', '— select —'], ...meds.map(m => [m.id, m.name])], w: '2fr' }, { n: 'price', l: 'Price ₹', t: 'number', min: 0, step: '0.01', w: '110px' }] }],
                note: v => `<span class="fs-sm">This rate auto-fills when you pick ${esc(s.name)} on a new purchase order — still editable per order.</span>`,
                onSave: async v => {
                    const seen = new Set();
                    const clean = v.lines.filter(l => l.medicine || l.price).map(l => {
                        if (!l.medicine) throw Error('Choose a medicine for every row');
                        if (seen.has(l.medicine)) throw Error('The same medicine is listed twice');
                        seen.add(l.medicine);
                        const p = num(l.price); if (!(p >= 0)) throw Error('Enter a valid price for ' + ((meds.find(m => m.id === l.medicine) || {}).name || l.medicine));
                        return { medicine: l.medicine, price: p.toFixed(2) };
                    });
                    const removed = list.filter(x => !clean.some(c => c.medicine === x.medicine));
                    for (const c of clean) await PH.setSupplierPrice(s.id, c.medicine, c.price);
                    for (const r of removed) await PH.deleteSupplierPrice(s.id, r.medicine);
                    CMS.toast('Price list saved'); re();
                }
            });
        };
        CMS.page(el, {
            title: 'Suppliers', btn: ['+ Add supplier', () => form()],
            cols: [['ID', s => s.id], ['Supplier', s => `<strong>${esc(s.name)}</strong>`, 1], ['Contact', s => esc(s.contact_person || '—'), 1], ['Phone', s => esc(s.phone || '—')],
            ['Email', s => esc(s.email || '—'), 1], ['Status', s => CMS.badge(s.is_active ? 'ACTIVE' : 'INACTIVE'), 1],
            ['', s => CMS.btn('pl', s.id, '💲 Prices', 'ghost') + CMS.btn('e', s.id, 'Edit', 'ghost') + CMS.btn('t', s.id, s.is_active ? 'Deactivate' : 'Activate', 'ghost') + CMS.btn('x', s.id, '🗑', 'ghost'), 1]], rows,
            on: { e: id => form(rows.find(s => s.id === id)), t: id => run(() => PH.setSupplierActive(id, !rows.find(s => s.id === id).is_active)),
                pl: id => priceDlg(rows.find(s => s.id === id)),
                x: id => { const s = rows.find(z => z.id === id); confirmDel(s.name, 'If it has purchase orders it cannot be deleted — deactivate it instead.', async () => { await PH.deleteSupplier(id); CMS.toast('Supplier deleted'); re() }) } }
        });
        tools(el, 'Suppliers', ['ID', 'Name', 'Contact', 'Phone', 'Email', 'Address', 'Status'], rows.map(s => [s.id, s.name, s.contact_person || '', s.phone || '', s.email || '', s.address || '', s.is_active ? 'ACTIVE' : 'INACTIVE']));
    }]);

    defs.push(['Purchases', async (el, re) => {
        let rows = [], sup = [], meds = [];
        const [P, S, M] = await Promise.allSettled([PH.purchases(), PH.suppliers(), PH.medicines()]);
        const bad = [P, S, M].find(x => x.status === 'rejected'); if (bad) CMS.toast(bad.reason.message);
        rows = P.value || []; sup = S.value || []; meds = M.value || [];
        const run = async fn => { try { await fn() } catch (e) { CMS.toast(e.message) } re() };
        const supName = id => (sup.find(s => s.id === id) || {}).name || id;
        const total = p => p.items.reduce((a, i) => a + i.quantity * Number(i.unit_cost), 0);
        const act = meds.filter(m => m.is_active);
        // each supplier's price list, fetched once per supplier and reused while this form is open
        const priceCache = {};
        const loadPrices = async sid => {
            if (!sid) return {};
            if (!priceCache[sid]) { priceCache[sid] = {}; try { (await PH.supplierPrices(sid)).forEach(x => priceCache[sid][x.medicine] = x.price) } catch (e) { } }
            return priceCache[sid];
        };
        // rates come from each supplier's price list (set on the Suppliers page) — the pharmacist only picks supplier, medicine and quantity
        await Promise.all(sup.map(s => loadPrices(s.id)));
        const rate = (sid, mid) => { const r = (priceCache[sid] || {})[mid]; return r == null || r === '' ? null : Number(r) };
        const medsFor = (sid, keep) => meds.filter(m => (m.is_active || m.id === keep) && rate(sid, m.id) != null);
        // editing = create the corrected order, then remove the old pending one (the API cannot update nested items)
        const form = old => dialog({
            title: old ? 'Edit purchase order ' + old.id : 'New purchase order', save: old ? 'Save changes' : 'Create order',
            init: old ? { supplier: old.supplier, purchase_date: old.purchase_date, lines: old.items.map(i => ({ medicine: i.medicine, quantity: i.quantity })) } : { purchase_date: CMS.today(), lines: [{}] },
            fields: [{ n: 'supplier', l: 'Supplier', req: 1, t: 'select', o: [['', '— select —'], ...sup.filter(s => s.is_active || (old && s.id === old.supplier)).map(s => [s.id, s.name])] }, { n: 'purchase_date', l: 'Order date', t: 'date' },
            { n: 'lines', l: 'Medicines (price is taken from the supplier\'s price list)', t: 'lines', cols: [{ n: 'medicine', l: 'Medicine', t: 'select', o: [['', '— select supplier first —'], ...act.map(m => [m.id, m.name])], w: '2fr' }, { n: 'quantity', l: 'Qty', t: 'number', min: 1, step: 1, w: '110px' }] }],
            note: v => {
                if (v.supplier && !medsFor(v.supplier).length) return `<span style="color:var(--warn,#b45309);font-weight:600">This supplier has no medicine prices yet — add them on the Suppliers page first.</span>`;
                const t = v.lines.reduce((a, l) => a + (num(l.quantity) || 0) * (l.medicine && v.supplier ? (rate(v.supplier, l.medicine) || 0) : 0), 0);
                return `Order total: <strong>${money(t)}</strong> <span class="fs-sm">— stock increases only when you mark the order received</span>`;
            },
            onSave: async v => {
                if (!v.supplier) throw Error('Choose a supplier'); if (!v.purchase_date) throw Error('Choose the order date');
                const items = lineItems(v.lines, false).map(i => {
                    const r = rate(v.supplier, i.medicine_id);
                    if (r == null) throw Error('This supplier has no price for the selected medicine — add it on the Suppliers page');
                    return { medicine: i.medicine_id, quantity: i.quantity, unit_cost: r.toFixed(2) };
                });
                await PH.addPurchase(v.supplier, v.purchase_date, items);
                if (old) await PH.deletePurchase(old.id);
                CMS.toast(old ? 'Purchase order updated' : 'Purchase order created'); re();
            },
            hook: (ov, close) => {
                const supSel = ov.querySelector('[name=supplier]');
                // show only the medicines this supplier has a price for
                const syncMeds = () => ov.querySelectorAll('[data-row]').forEach(row => {
                    const sel = row.querySelector('[data-c=medicine]'), cur = sel.value;
                    const list = supSel.value ? medsFor(supSel.value, cur) : [];
                    sel.innerHTML = `<option value="">${supSel.value ? '— select —' : '— select supplier first —'}</option>` + list.map(m => `<option value="${esc(m.id)}"${m.id === cur ? ' selected' : ''}>${esc(m.name)}</option>`).join('');
                    if (!list.some(m => m.id === cur)) sel.value = '';
                });
                ov.addEventListener('change', e => { if (e.target === supSel) { syncMeds(); ov.dispatchEvent(new Event('input')) } });
                ov.addEventListener('click', e => { if (e.target.closest('[data-add]')) setTimeout(syncMeds, 0) });
                syncMeds();
            }
        });
        const payDlg = p => dialog({
            title: 'Mark ' + p.id + ' as paid', save: '✓ Confirm payment',
            fields: [{ n: 'method', l: 'Payment method', t: 'select', req: 1, o: [['', '— select —'], ['CASH', 'Cash'], ['BANK', 'Bank transfer'], ['CHEQUE', 'Cheque'], ['UPI', 'UPI'], ['OTHER', 'Other']] },
            { n: 'reference', l: 'Reference / txn no.', ph: 'optional' }],
            note: () => `Pay to: <strong>${esc(supName(p.supplier))}</strong><br>Amount: <strong>${money(total(p))}</strong><br><span class="fs-sm">Once paid, this order's items and price are locked.</span>`,
            onSave: async v => { if (!v.method) throw Error('Choose how this was paid'); await PH.payPurchase(p.id, v.method, v.reference); CMS.toast(p.id + ' marked as paid'); re() }
        });
        CMS.page(el, {
            title: 'Purchase orders (restock)', btn: ['+ New purchase', () => form()],
            cols: [['ID', p => p.id], ['Supplier', p => `<strong>${esc(supName(p.supplier))}</strong>`, 1], ['Date', p => esc(p.purchase_date)],
            ['Items', p => p.items.map(i => esc(i.medicine_name) + ' × ' + i.quantity).join(', '), 1], ['Total', p => money(total(p))],
            ['Status', p => CMS.badge(p.status), 1], ['Payment', p => CMS.badge(p.payment_status), 1],
            ['', p => {
                const paid = p.payment_status === 'PAID', cancelled = p.status === 'CANCELLED';
                let a = '';
                if (p.status === 'PENDING') { a += CMS.btn('rc', p.id, '📥 Receive'); if (!paid) a += CMS.btn('ed', p.id, 'Edit', 'ghost') + CMS.btn('cx', p.id, 'Cancel', 'ghost') + CMS.btn('x', p.id, '🗑', 'ghost') }
                if (!cancelled) a += paid ? '<span class="fs-sm" title="Paid — locked">🔒 Paid</span> ' : CMS.btn('pay', p.id, '💰 Mark paid');
                return a + CMS.btn('pr', p.id, '🖨', 'ghost');
            }, 1]], rows,
            on: { rc: id => run(async () => { const r = await PH.receivePurchase(id); CMS.toast((r && r.detail) || 'Received — stock updated') }), cx: id => run(async () => { await PH.cancelPurchase(id); CMS.toast('Purchase cancelled') }),
                ed: id => form(rows.find(x => x.id === id)), pay: id => payDlg(rows.find(x => x.id === id)),
                x: id => confirmDel('purchase order ' + id, 'Only pending, unpaid orders can be deleted.', async () => { await PH.deletePurchase(id); CMS.toast('Purchase order deleted'); re() }),
                pr: id => {
                    const o = rows.find(x => x.id === id), s = sup.find(z => z.id === o.supplier) || {};
                    const payLine = o.payment_status === 'PAID' ? `Paid via ${esc(o.payment_method)}${o.payment_reference ? ' (Ref: ' + esc(o.payment_reference) + ')' : ''} on ${esc((o.paid_at || '').slice(0, 10))}` : 'Unpaid';
                    printDoc('Purchase order ' + id, `<h1>Purchase order ${esc(id)}</h1><h2>${stamp()}</h2><p class="meta"><strong>Supplier:</strong> ${esc(s.name || o.supplier)}</p><p class="meta"><strong>Phone:</strong> ${esc(s.phone || '—')} &nbsp; <strong>Email:</strong> ${esc(s.email || '—')}</p><p class="meta"><strong>Address:</strong> ${esc(s.address || '—')}</p><p class="meta"><strong>Order date:</strong> ${esc(o.purchase_date)} &nbsp; <strong>Status:</strong> ${esc(o.status)}</p><p class="meta"><strong>Payment:</strong> ${payLine}</p><table><tr><th>Medicine</th><th class="r">Qty</th><th class="r">Unit cost</th><th class="r">Amount</th></tr>${o.items.map(i => `<tr><td>${esc(i.medicine_name)}</td><td class="r">${i.quantity}</td><td class="r">${money(i.unit_cost)}</td><td class="r">${money(i.quantity * Number(i.unit_cost))}</td></tr>`).join('')}<tr><th colspan="3" class="r">Total</th><th class="r">${money(total(o))}</th></tr></table><div class="sig"><div>Prepared by</div><div>Supplier acknowledgement</div></div>`);
                }
            }
        });
        tools(el, 'Purchase orders', ['ID', 'Supplier', 'Date', 'Items', 'Total', 'Status', 'Payment'], rows.map(o => [o.id, supName(o.supplier), o.purchase_date, o.items.map(i => i.medicine_name + ' x' + i.quantity).join('; '), total(o), o.status, o.payment_status]));
    }]);

    defs.push(['Bills', async (el, re) => {
        let rows = []; try { rows = await PH.bills() } catch (e) { CMS.toast(e.message) }
        const unpaid = b => !/PAID|CANCEL/i.test(b.status || '');
        const bid = b => b.bill_id || b.id, dt = b => String(b.created_at || b.bill_date || '').slice(0, 10);
        CMS.page(el, {
            title: 'Bills', cols: [['Bill', b => bid(b)], ['Patient', b => esc(b.patient_name || b.patient || '—'), 1],
            ['Total', b => money(b.total_amount)], ['Status', b => CMS.badge(b.status || '—'), 1], ['Date', b => esc(dt(b))],
            ['', b => (unpaid(b) ? CMS.btn('pay', bid(b), 'Mark paid') : '<span class="fs-sm">Paid</span> ') + CMS.btn('pr', bid(b), '🖨', 'ghost'), 1]], rows,
            on: {
                pay: id => { const b = rows.find(x => bid(x) === id); dialog({
                    title: 'Mark ' + id + ' as paid', save: '✓ Confirm payment',
                    fields: [{ n: 'method', l: 'Payment method', t: 'select', req: 1, full: 1, o: [['', '— select —'], ['CASH', 'Cash'], ['CARD', 'Card'], ['UPI', 'UPI'], ['OTHER', 'Other']] }],
                    note: () => `Patient: <strong>${esc(b.patient_name || b.patient || '—')}</strong><br>Amount received: <strong>${money(b.total_amount)}</strong><br><span class="fs-sm">Once paid, the bill is locked and cannot be edited.</span>`,
                    onSave: async v => { if (!v.method) throw Error('Choose how the bill was paid'); await PH.payBill(id, v.method); CMS.toast(id + ' marked as paid'); re() }
                }) },
                pr: id => { const b = rows.find(x => bid(x) === id); printDoc('Bill ' + id, `<h1>Clinic CMS — Bill ${esc(id)}</h1><h2>${stamp()}</h2><p class="meta"><strong>Patient:</strong> ${esc(b.patient_name || b.patient || '—')}</p><p class="meta"><strong>Date:</strong> ${esc(dt(b))} &nbsp; <strong>Status:</strong> ${esc(b.status || '—')}</p><table><tr><th>Description</th><th class="r">Amount</th></tr><tr><td>Total charges</td><td class="r">${money(b.total_amount)}</td></tr></table><div class="sig"><div>Cashier</div><div>Patient</div></div>`) } }
        });
        tools(el, 'Bills', ['Bill', 'Patient', 'Total', 'Status', 'Date'], rows.map(b => [bid(b), b.patient_name || b.patient || '', b.total_amount, b.status || '', dt(b)]));
    }]);

    /* ---------- sidebar icons (edit ICONS to change them) ---------- */
    const ICONS = { 'Dashboard': '📊', 'Prescription queue': '💊', 'Inventory': '📦', 'Suppliers': '🚚', 'Purchases': '🧾', 'Bills': '💳' };
    const NAV = 'aside, nav, [class*="side"], [class*="nav"]';
    const iconize = () => {
        const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), nodes = [];
        while (tw.nextNode()) nodes.push(tw.currentNode);
        nodes.forEach(n => {
            const ic = ICONS[n.nodeValue.trim()], P = n.parentElement;
            if (!ic || !P || !P.closest(NAV)) return;
            const short = e => e && !e.children.length && e.textContent.trim().length <= 4;
            const slot = (!P.children.length && short(P.previousElementSibling)) ? P.previousElementSibling : [...P.children].find(short);
            if (slot) { if (slot.textContent.trim() !== ic) slot.textContent = ic }
            else if (!P.querySelector(':scope > [data-phi]')) { const s = document.createElement('span'); s.dataset.phi = 1; s.textContent = ic; s.style.marginRight = '10px'; P.insertBefore(s, n) }
        });
    };
    let raf = 0;
    const obs = new MutationObserver(() => { clearTimeout(raf); raf = setTimeout(() => { obs.disconnect(); iconize(); obs.observe(document.body, { childList: true, subtree: true }) }, 30) });
    iconize(); obs.observe(document.body, { childList: true, subtree: true });

    CMS.mods.PHARMACIST = defs.map(([n, f]) => { const w = el => f(el, () => w(el)); return [n, w] });
})();
