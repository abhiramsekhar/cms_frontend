window.PH_VERSION = 'v4-limits-pricelist-purchase-pay';
/* pharmacy/api.js — the only place that talks to the Django backend (cms_pharmapp).
   mode: 'live' = backend only | 'demo' = built-in sample data only | 'auto' = try backend, fall back to demo */
window.PHARMA_API = window.PHARMA_API || {
    mode: 'auto',
    demoBanner: false,                                                // true = show the orange "demo mode" bar
    base: 'http://127.0.0.1:8000/api/pharmacy',                      // where cms_pharmapp.urls is mounted
    prescriptions: 'http://127.0.0.1:8000/api/doctor/prescriptions', // ASSUMED: doctor app list endpoint
    bills: 'http://127.0.0.1:8000/api/reception/bills',              // ASSUMED: reception app bills endpoint
    tokenKey: 'token',                                                // localStorage key holding the auth token
    scheme: 'Bearer'                                                  // 'Bearer' (JWT) or 'Token' (DRF token)
};

window.PH = (() => {
    const cfg = window.PHARMA_API;
    const todayISO = () => new Date().toISOString().slice(0, 10);

    /* ---------- shared stock rule: discard expired stock, then cap at max_stock_level ----------
       cur: {stock_quantity, expiry_date, max_stock_level}. Used by restock() AND by the demo
       "receive purchase" handler, so both paths apply the exact same rule. */
    const DEFAULT_MAX_STOCK = 500; // used when a medicine has no max_stock_level of its own
    function projectStock(cur, addQty) {
        const isExpired = !!(cur.expiry_date && cur.expiry_date < todayISO());
        const base = isExpired ? 0 : (cur.stock_quantity || 0);
        const discarded = isExpired ? (cur.stock_quantity || 0) : 0;
        let newStock = base + addQty, capped = 0;
        const max = (cur.max_stock_level != null && cur.max_stock_level !== '') ? Number(cur.max_stock_level) : DEFAULT_MAX_STOCK;
        if (newStock > max) { capped = newStock - max; newStock = max }
        return { newStock, discarded, capped };
    }

    /* ================= built-in demo data (hard-coded sample records) ================= */
    const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
    const iso = n => new Date(Date.now() + n * 864e5).toISOString();
    const M = (id, name, generic, maker, cat, cost, sell, stock, thr, exp, max = null) => ({
        medicine_id: id, name, generic_name: generic, manufacturer: maker, category: cat, cost_price: cost.toFixed(2), selling_price: sell.toFixed(2),
        stock_quantity: stock, reorder_threshold: thr, max_stock_level: max, expiry_date: day(exp), is_active: true
    });
    const DEMO = {
        medicines: [
            M('MED-0001', 'Paracetamol', 'Acetaminophen', 'Cipla', 'Tablet', 1.2, 2, 120, 30, 400, 300),
            M('MED-0002', 'Amoxicillin', 'Amoxicillin Trihydrate', 'Sun Pharma', 'Capsule', 4, 6.5, 8, 20, 200, 150),
            M('MED-0003', 'Cough Syrup', 'Dextromethorphan', 'Dabur', 'Syrup', 35, 55, 45, 15, 20, null),
            M('MED-0004', 'Insulin Glargine', 'Insulin Glargine', 'Novo Nordisk', 'Injection', 300, 380, 12, 10, 90, 50),
            M('MED-0005', 'Ibuprofen', 'Ibuprofen', 'Cipla', 'Tablet', 1.5, 3, 3, 15, 300, 100),
            M('MED-0006', 'Cetirizine', 'Cetirizine Hydrochloride', 'Dr Reddys', 'Tablet', 0.8, 2, 200, 40, -30, 150),
            M('MED-0007', 'Azithromycin', 'Azithromycin', 'Cipla', 'Tablet', 12, 20, 60, 20, 250, 200),
            { ...M('MED-0008', 'Omeprazole', 'Omeprazole', 'Sun Pharma', 'Capsule', 2, 4, 25, 10, 180, null), is_active: false }],
        suppliers: [
            { supplier_id: 'SUP-0001', name: 'MediCore Distributors', contact_person: 'Rahul Menon', phone: '+919847012345', email: 'sales@medicore.in', address: 'Statue Junction, Thiruvananthapuram', is_active: true },
            { supplier_id: 'SUP-0002', name: 'Kerala Pharma Traders', contact_person: 'Anjali Nair', phone: '+919946001122', email: 'orders@keralapharma.in', address: 'MG Road, Kochi', is_active: true },
            { supplier_id: 'SUP-0003', name: 'LifeLine Wholesale', contact_person: 'Suresh Kumar', phone: '+919388776655', email: 'info@lifeline.in', address: 'Palayam, Thiruvananthapuram', is_active: true },
            { supplier_id: 'SUP-0004', name: 'Apex Healthcare Supplies', contact_person: 'Divya Thomas', phone: '+914712345678', email: 'apex@healthsupply.in', address: 'Kowdiar, Thiruvananthapuram', is_active: false }],
        // each supplier's agreed rate per medicine — auto-fills the purchase form, still editable per order
        priceLists: {
            'SUP-0001': { 'MED-0001': '1.20', 'MED-0003': '32.00', 'MED-0006': '0.75' },
            'SUP-0002': { 'MED-0002': '4.00', 'MED-0005': '1.50' },
            'SUP-0003': { 'MED-0004': '300.00', 'MED-0007': '11.50' }
        },
        purchases: [
            { purchase_id: 'PUR-0001', supplier: 'SUP-0001', purchase_date: day(-20), status: 'RECEIVED', total_amount: '240.00', payment_status: 'PAID', payment_method: 'BANK', payment_reference: 'TXN-77821', paid_at: iso(-18), items: [{ item_id: 'PURI-0001', medicine: 'MED-0001', medicine_name: 'Paracetamol', quantity: 200, unit_cost: '1.20' }] },
            { purchase_id: 'PUR-0002', supplier: 'SUP-0002', purchase_date: day(-2), status: 'PENDING', total_amount: '0.00', payment_status: 'UNPAID', payment_method: null, payment_reference: null, paid_at: null, items: [{ item_id: 'PURI-0002', medicine: 'MED-0002', medicine_name: 'Amoxicillin', quantity: 100, unit_cost: '4.00' }, { item_id: 'PURI-0003', medicine: 'MED-0005', medicine_name: 'Ibuprofen', quantity: 80, unit_cost: '1.50' }] },
            { purchase_id: 'PUR-0003', supplier: 'SUP-0003', purchase_date: day(-9), status: 'CANCELLED', total_amount: '0.00', payment_status: 'UNPAID', payment_method: null, payment_reference: null, paid_at: null, items: [{ item_id: 'PURI-0004', medicine: 'MED-0004', medicine_name: 'Insulin Glargine', quantity: 20, unit_cost: '300.00' }] }],
        prescriptions: [
            { prescription_id: 'RX-1001', patient: 'PAT-001', patient_name: 'Anil Kumar', doctor_name: 'Dr. Meera Nair', medicine: 'MED-0001', medicine_name: 'Paracetamol', qty: 10, dosage: '1 tablet, 3 times a day', status: 'PENDING', bill_id: 'BILL-2001' },
            { prescription_id: 'RX-1002', patient: 'PAT-002', patient_name: 'Sreelakshmi P', doctor_name: 'Dr. Arun Varma', medicine: 'MED-0002', medicine_name: 'Amoxicillin', qty: 15, dosage: '1 capsule, twice a day', status: 'PENDING', bill_id: 'BILL-2002' },
            { prescription_id: 'RX-1003', patient: 'PAT-003', patient_name: 'Joseph Mathew', doctor_name: 'Dr. Meera Nair', medicine: 'MED-0003', medicine_name: 'Cough Syrup', qty: 2, dosage: '10 ml, twice a day', status: 'PENDING', bill_id: 'BILL-2003' },
            { prescription_id: 'RX-1004', patient: 'PAT-004', patient_name: 'Fathima Beevi', doctor_name: 'Dr. Arun Varma', medicine: 'MED-0007', medicine_name: 'Azithromycin', qty: 6, dosage: '1 tablet daily', status: 'DISPENSED', bill_id: 'BILL-2004' },
            { prescription_id: 'RX-1005', patient: 'PAT-005', patient_name: 'Rajesh Pillai', doctor_name: 'Dr. Meera Nair', medicine: 'MED-0004', medicine_name: 'Insulin Glargine', qty: 1, dosage: '10 units at night', status: 'PENDING', bill_id: 'BILL-2005' }],
        bills: [
            { bill_id: 'BILL-2001', patient: 'PAT-001', patient_name: 'Anil Kumar', total_amount: '350.00', status: 'OPEN', created_at: iso(-1) },
            { bill_id: 'BILL-2002', patient: 'PAT-002', patient_name: 'Sreelakshmi P', total_amount: '500.00', status: 'OPEN', created_at: iso(-1) },
            { bill_id: 'BILL-2003', patient: 'PAT-003', patient_name: 'Joseph Mathew', total_amount: '200.00', status: 'OPEN', created_at: iso(0) },
            { bill_id: 'BILL-2004', patient: 'PAT-004', patient_name: 'Fathima Beevi', total_amount: '920.00', status: 'PAID', created_at: iso(-4) },
            { bill_id: 'BILL-2005', patient: 'PAT-005', patient_name: 'Rajesh Pillai', total_amount: '150.00', status: 'OPEN', created_at: iso(0) }]
    };
    const clone = x => JSON.parse(JSON.stringify(x));
    const nextId = (arr, key, pre) => pre + '-' + String(Math.max(0, ...arr.map(x => +String(x[key]).split('-')[1] || 0)) + 1).padStart(4, '0');

    function demoMedCheck(rec, self) {
        if (!/^[A-Za-z][A-Za-z \-]{2,}$/.test(rec.name || '')) throw Error('name: Name must be at least 3 characters long and contain only letters, spaces, or hyphens.');
        if (DEMO.medicines.some(x => x !== self && x.name.toLowerCase() === rec.name.toLowerCase() && (x.manufacturer || '') === (rec.manufacturer || '')))
            throw Error('A medicine with this name and manufacturer already exists.');
        if (Number(rec.selling_price) < Number(rec.cost_price)) throw Error('Selling price cannot be lower than cost price.');
        if (Number(rec.stock_quantity) < 0) throw Error('Stock quantity cannot be negative.');
        if (rec.max_stock_level != null && rec.max_stock_level !== '' && Number(rec.max_stock_level) < Number(rec.reorder_threshold))
            throw Error('Max stock level cannot be lower than the reorder level.');
    }

    function demoReq(url, opt) {
        const m = (opt.method || 'GET').toUpperCase(), body = opt.body ? JSON.parse(opt.body) : {};
        if (url.startsWith(cfg.prescriptions)) return clone(DEMO.prescriptions);
        if (url.startsWith(cfg.bills)) {
            const bm = url.replace(cfg.bills, '').split('?')[0].match(/^\/([^/]+)\/$/);
            if (bm && m === 'PATCH') {
                const b = DEMO.bills.find(r => r.bill_id === bm[1]); if (!b) throw Error('Bill not found.');
                if (/PAID|CANCEL/i.test(b.status)) throw Error('This bill is already ' + b.status.toLowerCase() + ' and cannot be changed.');
                Object.assign(b, body); return clone(b);
            }
            return clone(DEMO.bills);
        }
        const path = url.replace(cfg.base, '').split('?')[0];
        let x;
        // ---- supplier price list (a supplier's agreed rate per medicine) ----
        if ((x = path.match(/^\/suppliers\/([^/]+)\/prices\/(?:([^/]+)\/)?$/))) {
            const sid = x[1], mid = x[2];
            if (!DEMO.suppliers.some(s => s.supplier_id === sid)) throw Error('Supplier not found.');
            DEMO.priceLists[sid] = DEMO.priceLists[sid] || {};
            if (!mid && m === 'GET') return Object.entries(DEMO.priceLists[sid]).map(([medId, price]) => { const med = DEMO.medicines.find(r => r.medicine_id === medId); return { medicine: medId, medicine_name: med ? med.name : medId, price } });
            if (!mid && m === 'POST') {
                if (!body.medicine) throw Error('medicine: choose a medicine.');
                if (!(Number(body.price) >= 0)) throw Error('price: enter a valid amount.');
                if (!DEMO.medicines.some(r => r.medicine_id === body.medicine)) throw Error('medicine: not found.');
                DEMO.priceLists[sid][body.medicine] = Number(body.price).toFixed(2);
                const med = DEMO.medicines.find(r => r.medicine_id === body.medicine);
                return { medicine: body.medicine, medicine_name: med.name, price: DEMO.priceLists[sid][body.medicine] };
            }
            if (mid && m === 'DELETE') { delete DEMO.priceLists[sid][mid]; return null }
        }
        if ((x = path.match(/^\/medicines\/(?:([^/]+)\/)?$/))) {
            const id = x[1];
            if (!id && m === 'GET') return clone(DEMO.medicines);
            if (!id && m === 'POST') {
                const rec = { generic_name: null, manufacturer: null, category: null, cost_price: '0.00', reorder_threshold: 10, max_stock_level: null, stock_quantity: 0, expiry_date: null, is_active: true, ...body, medicine_id: nextId(DEMO.medicines, 'medicine_id', 'MED') };
                demoMedCheck(rec, null); DEMO.medicines.push(rec); return clone(rec);
            }
            const rec = DEMO.medicines.find(r => r.medicine_id === id); if (!rec) throw Error('Not found.');
            if (m === 'GET') return clone(rec);
            if (m === 'PATCH') { demoMedCheck({ ...rec, ...body }, rec); Object.assign(rec, body); return clone(rec) }
            if (m === 'DELETE') {
                if (DEMO.purchases.some(p => p.items.some(i => i.medicine === id))) throw Error('Cannot delete: this medicine is used in purchase orders. Deactivate it instead.');
                DEMO.medicines.splice(DEMO.medicines.indexOf(rec), 1); return null;
            }
        }
        if ((x = path.match(/^\/suppliers\/(?:([^/]+)\/)?$/))) {
            const id = x[1];
            if (!id && m === 'GET') return clone(DEMO.suppliers);
            if (!id && m === 'POST') { if ((body.name || '').length < 3) throw Error('name: Supplier name must be at least 3 characters long.'); const rec = { contact_person: null, phone: null, email: null, address: null, is_active: true, ...body, supplier_id: nextId(DEMO.suppliers, 'supplier_id', 'SUP') }; DEMO.suppliers.push(rec); return clone(rec) }
            const rec = DEMO.suppliers.find(r => r.supplier_id === id); if (!rec) throw Error('Not found.');
            if (m === 'GET') return clone(rec);
            if (m === 'PATCH') { Object.assign(rec, body); return clone(rec) }
            if (m === 'DELETE') {
                if (DEMO.purchases.some(p => p.supplier === id)) throw Error('Cannot delete: this supplier has purchase orders. Deactivate it instead.');
                DEMO.suppliers.splice(DEMO.suppliers.indexOf(rec), 1); return null;
            }
        }
        if ((x = path.match(/^\/purchases\/([^/]+)\/$/)) && m === 'DELETE') {
            const p = DEMO.purchases.find(r => r.purchase_id === x[1]); if (!p) throw Error('Not found.');
            if (p.payment_status === 'PAID') throw Error('This purchase order is paid and can no longer be changed.');
            if (p.status !== 'PENDING') throw Error('A ' + p.status.toLowerCase() + ' purchase can no longer be changed.');
            DEMO.purchases.splice(DEMO.purchases.indexOf(p), 1); return null;
        }
        if ((x = path.match(/^\/purchases\/([^/]+)\/pay\/$/)) && m === 'POST') {
            const p = DEMO.purchases.find(r => r.purchase_id === x[1]); if (!p) throw Error('Not found.');
            if (p.status === 'CANCELLED') throw Error('A cancelled purchase order cannot be marked paid.');
            if (p.payment_status === 'PAID') throw Error('This purchase order is already marked paid.');
            if (!body.payment_method) throw Error('payment_method: choose how it was paid.');
            p.payment_status = 'PAID'; p.payment_method = body.payment_method; p.payment_reference = body.reference || ''; p.paid_at = new Date().toISOString();
            return { detail: 'Purchase order marked as paid.' };
        }
        if ((x = path.match(/^\/purchases\/(?:([^/]+)\/(receive|cancel)\/)?$/)) && (!x[1] || m === 'POST')) {
            if (!x[1] && m === 'GET') return clone(DEMO.purchases);
            if (!x[1] && m === 'POST') {
                if (!DEMO.suppliers.some(s => s.supplier_id === body.supplier)) throw Error('supplier: Invalid supplier.');
                const items = (body.items || []).map((i, n) => { const med = DEMO.medicines.find(r => r.medicine_id === i.medicine); if (!med) throw Error('items: Medicine not found.'); return { item_id: nextId(DEMO.purchases.flatMap(p => p.items), 'item_id', 'PURI').replace(/(\d+)$/, v => String(+v + n).padStart(4, '0')), medicine: i.medicine, medicine_name: med.name, quantity: i.quantity, unit_cost: i.unit_cost } });
                const rec = { purchase_id: nextId(DEMO.purchases, 'purchase_id', 'PUR'), supplier: body.supplier, purchase_date: body.purchase_date, status: 'PENDING', total_amount: '0.00', payment_status: 'UNPAID', payment_method: null, payment_reference: null, paid_at: null, items };
                DEMO.purchases.unshift(rec); return clone(rec);
            }
            const p = DEMO.purchases.find(r => r.purchase_id === x[1]); if (!p) throw Error('Not found.');
            if (x[2] === 'receive') {
                if (p.status !== 'PENDING') throw Error('Only a pending purchase can be received.');
                let tot = 0, notes = [];
                p.items.forEach(i => {
                    const med = DEMO.medicines.find(r => r.medicine_id === i.medicine);
                    const proj = projectStock(med, i.quantity);
                    if (proj.discarded) notes.push(`${med.name}: ${proj.discarded} expired unit${proj.discarded > 1 ? 's' : ''} discarded`);
                    if (proj.capped) notes.push(`${med.name}: ${proj.capped} unit${proj.capped > 1 ? 's' : ''} over the limit not added`);
                    med.stock_quantity = proj.newStock; tot += i.quantity * Number(i.unit_cost);
                });
                p.status = 'RECEIVED'; p.total_amount = tot.toFixed(2);
                return { detail: 'Purchase received and stock updated.' + (notes.length ? ' ' + notes.join('; ') + '.' : '') };
            }
            if (p.payment_status === 'PAID') throw Error('This purchase order is paid and can no longer be cancelled.');
            if (p.status !== 'PENDING') throw Error('Only a pending purchase can be cancelled.');
            p.status = 'CANCELLED'; return { detail: 'Purchase cancelled.' };
        }
        if (path === '/dispense/' && m === 'POST') {
            const rx = DEMO.prescriptions.find(r => r.prescription_id === body.prescription_id); if (!rx) throw Error('Prescription not found.');
            if (rx.status === 'DISPENSED') throw Error('This prescription has already been dispensed.');
            const bill = DEMO.bills.find(r => r.bill_id === body.bill_id); if (!bill) throw Error('Bill not found.');
            const lines = body.items.map(i => {
                const med = DEMO.medicines.find(r => r.medicine_id === i.medicine_id);
                if (!med || !med.is_active) throw Error('Medicine not found or inactive.');
                if (med.expiry_date && med.expiry_date < day(0)) throw Error(`'${med.name}' expired on ${med.expiry_date} and cannot be dispensed.`);
                if (med.stock_quantity < i.quantity) throw Error(`Insufficient stock for '${med.name}': available ${med.stock_quantity}, requested ${i.quantity}.`);
                return [med, i.quantity];
            });
            lines.forEach(([med, q]) => { med.stock_quantity -= q; bill.total_amount = (Number(bill.total_amount) + Number(med.selling_price) * q).toFixed(2) });
            rx.status = 'DISPENSED'; return { detail: 'Prescription dispensed successfully.' };
        }
        throw Error('Demo mode: unsupported request ' + m + ' ' + path);
    }

    /* ================= request layer ================= */
    function banner(msg, color) {
        let b = document.getElementById('ph-banner');
        if (!b) { b = document.createElement('div'); b.id = 'ph-banner'; document.body.appendChild(b) }
        b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10000;color:#fff;padding:10px 16px;font:600 13px Inter,sans-serif;display:flex;gap:12px;justify-content:space-between;align-items:center;background:' + (color || '#b42318');
        b.innerHTML = '<span></span><button style="background:transparent;border:1px solid #fff;color:#fff;border-radius:8px;padding:2px 10px;cursor:pointer">✕</button>';
        b.firstChild.textContent = msg; b.lastChild.onclick = () => b.remove();
    }
    const why = (status, url) =>
        status === 0 ? 'Cannot reach the backend at ' + url + ' — is Django running, is the URL in api.js correct, and is CORS enabled (django-cors-headers)?'
            : status === 401 || status === 403 ? 'Backend refused the request (' + status + '): not logged in. No valid token found in localStorage["' + cfg.tokenKey + '"].'
                : status === 404 ? 'Backend URL not found (404): ' + url + ' — check "base" in api.js against your project urls.py.'
                    : status >= 500 ? 'Backend error (' + status + ') — see the Django terminal for the traceback.' : '';

    const errText = d => {
        if (!d) return '';
        if (typeof d === 'string') return d;
        if (Array.isArray(d)) return d.map(errText).join(' ');
        if (d.detail) return errText(d.detail);
        return Object.entries(d).map(([k, v]) => (k === 'non_field_errors' ? '' : k + ': ') + errText(v)).join(' | ');
    };

    async function live(url, opt) {
        const headers = { 'Content-Type': 'application/json' };
        const t = localStorage.getItem(cfg.tokenKey);
        if (t) headers.Authorization = cfg.scheme + ' ' + t;
        let r;
        try { r = await fetch(url, { ...opt, headers, credentials: 'include' }) }
        catch (e) { console.error('[PH] network/CORS error for', url, e); if (cfg.mode === 'live') banner(why(0, url)); const er = Error('Cannot reach server'); er.fallback = true; throw er }
        let d = null; try { d = await r.json() } catch (e) { }
        if (!r.ok) {
            console.error('[PH]', r.status, url, d);
            const h = why(r.status, url); if (h && cfg.mode === 'live') banner(h);
            const er = Error(errText(d) || 'Request failed (' + r.status + ')');
            er.fallback = [401, 403, 404].includes(r.status) || r.status >= 500; throw er;
        }
        return d;
    }

    let demoOn = cfg.mode === 'demo';
    const demoNote = () => cfg.demoBanner && banner('Demo mode: showing built-in sample data (backend not reachable or not logged in). Changes are kept only until you reload the page.', '#b45309');
    if (demoOn) setTimeout(demoNote, 0);
    async function req(url, opt = {}) {
        if (demoOn) return demoReq(url, opt);
        try { return await live(url, opt) }
        catch (e) { if (cfg.mode === 'auto' && e.fallback) { demoOn = true; demoNote(); return demoReq(url, opt) } throw e }
    }

    // Handles both plain lists and DRF-paginated {results, next}
    async function list(url) {
        let out = [], next = url;
        while (next) {
            const d = await req(next);
            if (Array.isArray(d)) return d;
            out = out.concat(d.results || []);
            next = d.next;
        }
        return out;
    }

    // backend medicine -> the shape the UI uses
    const med = m => ({
        id: m.medicine_id, name: m.name, generic: m.generic_name || '', maker: m.manufacturer || '', category: m.category || '',
        cost: Number(m.cost_price), price: Number(m.selling_price), stock: m.stock_quantity, threshold: m.reorder_threshold,
        maxStock: (m.max_stock_level != null && m.max_stock_level !== '') ? Number(m.max_stock_level) : DEFAULT_MAX_STOCK,
        expiry: m.expiry_date || '', is_active: m.is_active
    });

    return {
        // ---- inventory ----
        medicines: async () => (await list(cfg.base + '/medicines/')).map(med),
        addMedicine: body => req(cfg.base + '/medicines/', { method: 'POST', body: JSON.stringify(body) }),
        updateMedicine: (id, body) => req(cfg.base + '/medicines/' + id + '/', { method: 'PATCH', body: JSON.stringify(body) }),
        // Restock: read the current record, discard any expired stock, add qty, cap at max_stock_level.
        // newExpiry: when restocking something currently expired, the fresh stock's new expiry date —
        // otherwise the medicine would still read as "expired" and get discarded again on the next restock.
        restock: async (id, qty, newExpiry) => {
            const cur = await req(cfg.base + '/medicines/' + id + '/');
            const proj = projectStock(cur, qty);
            const body = { stock_quantity: proj.newStock };
            if (proj.discarded && newExpiry) body.expiry_date = newExpiry;
            const updated = await req(cfg.base + '/medicines/' + id + '/', { method: 'PATCH', body: JSON.stringify(body) });
            return { ...updated, discardedQty: proj.discarded, cappedQty: proj.capped };
        },
        // preview the same rule before the user confirms (m is the UI-shaped medicine from medicines())
        DEFAULT_MAX_STOCK,
        projectStock: (m, addQty) => projectStock({ stock_quantity: m.stock, expiry_date: m.expiry, max_stock_level: m.maxStock }, addQty),
        deleteMedicine: id => req(cfg.base + '/medicines/' + id + '/', { method: 'DELETE' }),
        setActive: (id, on) => req(cfg.base + '/medicines/' + id + '/', { method: 'PATCH', body: JSON.stringify({ is_active: on }) }),
        // ---- suppliers ----
        suppliers: async () => (await list(cfg.base + '/suppliers/')).map(x => ({ ...x, id: x.supplier_id })),
        addSupplier: v => req(cfg.base + '/suppliers/', { method: 'POST', body: JSON.stringify(v) }),
        deleteSupplier: id => req(cfg.base + '/suppliers/' + id + '/', { method: 'DELETE' }),
        updateSupplier: (id, body) => req(cfg.base + '/suppliers/' + id + '/', { method: 'PATCH', body: JSON.stringify(body) }),
        setSupplierActive: (id, on) => req(cfg.base + '/suppliers/' + id + '/', { method: 'PATCH', body: JSON.stringify({ is_active: on }) }),
        // ASSUMED endpoints: a supplier's saved rate per medicine
        supplierPrices: sid => list(cfg.base + '/suppliers/' + sid + '/prices/'),
        setSupplierPrice: (sid, medicine, price) => req(cfg.base + '/suppliers/' + sid + '/prices/', { method: 'POST', body: JSON.stringify({ medicine, price }) }),
        deleteSupplierPrice: (sid, medicine) => req(cfg.base + '/suppliers/' + sid + '/prices/' + medicine + '/', { method: 'DELETE' }),
        // ---- purchases (restock orders) ----
        purchases: async () => (await list(cfg.base + '/purchases/')).map(x => ({ ...x, id: x.purchase_id, payment_status: x.payment_status || 'UNPAID' })),
        addPurchase: (supplier, purchase_date, items) => req(cfg.base + '/purchases/', { method: 'POST', body: JSON.stringify({ supplier, purchase_date, items }) }),
        deletePurchase: id => req(cfg.base + '/purchases/' + id + '/', { method: 'DELETE' }),
        receivePurchase: id => req(cfg.base + '/purchases/' + id + '/receive/', { method: 'POST', body: '{}' }),
        cancelPurchase: id => req(cfg.base + '/purchases/' + id + '/cancel/', { method: 'POST', body: '{}' }),
        // ASSUMED endpoint: mark a purchase order as paid to the supplier
        payPurchase: (id, payment_method, reference) => req(cfg.base + '/purchases/' + id + '/pay/', { method: 'POST', body: JSON.stringify({ payment_method, reference }) }),
        // ---- bills ----
        bills: () => list(cfg.bills + '/'),
        // ASSUMED: PATCH <bills>/<id>/ accepts {status, payment_method} — adjust to your reception API
        payBill: (id, payment_method) => req(cfg.bills + '/' + id + '/', { method: 'PATCH', body: JSON.stringify({ status: 'PAID', payment_method }) }),
        // ---- prescriptions ----
        prescriptions: () => list(cfg.prescriptions + '/'),
        dispense: (prescription_id, bill_id, items) => req(cfg.base + '/dispense/', { method: 'POST', body: JSON.stringify({ prescription_id, bill_id, items }) })
    };
})();
