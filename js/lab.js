CMS.mods.LAB_TECH = [
    ['Lab queue', el => {
        const S = CMS.S, re = () => CMS.mods.LAB_TECH[0][1](el);
        const statusPipe = o => {
            const steps = ['ORDERED', 'IN_PROGRESS', 'COMPLETED'], cur = steps.indexOf(o.status);
            return `<div style="display:flex;align-items:center;gap:4px">${steps.map((s, i) => `<div style="width:28px;height:6px;border-radius:99px;background:${i <= cur ? 'var(--acc)' : 'var(--line)'};transition:background 0.3s"></div>`).join('<div style="width:4px"></div>')}</div>`
        };
        CMS.page(el, {
            title: 'Lab queue', cols: [['Order', o => o.id], ['Patient', o => S.pn(o.patient)], ['Test', o => `<strong>${CMS.esc(S.tn(o.test))}</strong>`, 1], ['Doctor', o => S.un(o.doctor)],
            ['Progress', o => statusPipe(o), 1], ['Status', o => CMS.badge(o.status), 1],
            ['Result', o => o.result ? `${CMS.esc(o.result)} <span class="badge ${o.flag === 'Normal' ? 'ACTIVE' : 'CANCELLED'}">${CMS.esc(o.flag)}</span>` : '<span class="text-mute">—</span>', 1],
            ['', o => o.status === 'ORDERED' ? CMS.btn('s', o.id, '▶ Start') : o.status === 'IN_PROGRESS' ? CMS.btn('r', o.id, '📝 Enter result') : '', 1]], rows: [...CMS.all('labOrders')].sort((a, b) => (a.status === 'COMPLETED') - (b.status === 'COMPLETED')),
            on: { s: id => { S.labStart(id); re() }, r: id => CMS.form('Enter result', [{ n: 'result', l: 'Result / findings', t: 'textarea' }, { n: 'flag', l: 'Flag', t: 'select', o: ['Normal', 'Abnormal'] }], v => S.labResult(id, v), re) }
        })
    }]];
