/**
 * Clinova Healthcare — Pharmacy API
 * Business logic for inventory, dispensing, and purchasing.
 *
 * Schema field mapping (fixes validation errors):
 *   medicine.form       (not category-as-form)
 *   medicine.strength   (required)
 *   medicine.unitPrice  (paise, not "price")
 *   medicine.batches    [{ batchNo, expiryDate, quantity, receivedDate }]
 *   medicine.maxStock   (optional, new)
 *   purchaseOrder.totalAmount (required, paise)
 *   purchaseOrder.orderDate   (required, ISO date string)
 *
 * Supplier rate list stored per-supplier in suppliers.rates:
 *   { medicineId: string, rate: number (paise) }[]
 */

import { db, DbError } from '../data/db.js';

/* ── helpers ── */
const today = () => new Date().toISOString().split('T')[0];
const nowISO = () => new Date().toISOString();

/**
 * Return only valid (non-expired, quantity > 0) batches for a medicine,
 * sorted by expiry ascending (FEFO).
 */
function validBatches(med) {
  const t = today();
  return (med.batches || [])
    .filter(b => b.quantity > 0 && b.expiryDate >= t)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

/**
 * Compute available stock (valid batches only).
 */
function availableStock(med) {
  return validBatches(med).reduce((s, b) => s + b.quantity, 0);
}

/**
 * Remove all expired batches from a medicine's batch list.
 * Returns { updatedBatches, removedCount, removedUnits } for UI messaging.
 */
function purgeExpiredBatches(batches) {
  const t = today();
  const expired = batches.filter(b => b.expiryDate < t);
  const valid = batches.filter(b => b.expiryDate >= t);
  const removedCount = expired.length;
  const removedUnits = expired.reduce((s, b) => s + (b.quantity || 0), 0);
  return { updatedBatches: valid, removedCount, removedUnits };
}

export const pharmacy = {
  /* ─────────────────────────────────────────────
     STOCK HELPERS
  ───────────────────────────────────────────── */
  /**
   * Legacy helper kept for backward compat with dashboard.
   * Returns total of ALL batches (including expired) – same as before.
   * Use availableStock() for dispensing checks.
   */
  getStockLevel(medicine) {
    if (!medicine || !medicine.batches) return 0;
    return medicine.batches.reduce((t, b) => t + b.quantity, 0);
  },

  /** Valid stock only (non-expired, quantity > 0). */
  getAvailableStock(medicine) {
    return availableStock(medicine);
  },

  /* ─────────────────────────────────────────────
     INVENTORY
  ───────────────────────────────────────────── */
  listMedicines() {
    const t = today();
    return db.getAll('medicines')
      .map(m => {
        // Attach computed fields for UI
        const vb = validBatches(m);
        m.stockLevel = vb.reduce((s, b) => s + b.quantity, 0);
        m.hasExpired = (m.batches || []).some(b => b.expiryDate < t && b.quantity > 0);
        // backward-compat: expose unitPrice as price for old renderers
        m.price = m.unitPrice;
        return m;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  addMedicine(data) {
    return db.transaction(tx => {
      const newMed = {
        id: db.generateId('med'),
        name: data.name,
        genericName: data.genericName,
        category: data.category,          // drug category (Analgesic, Antibiotic, …)
        form: data.form,                  // dosage form (Tablet, Capsule, Syrup, …)
        strength: data.strength,          // e.g. "500mg"
        manufacturer: data.manufacturer || '',
        unitPrice: data.unitPrice,        // paise (required by schema)
        unitSize: data.unitSize || '',    // display unit (e.g. "1 Strip")
        reorderLevel: data.reorderLevel,
        maxStock: data.maxStock || null,  // optional upper limit
        batches: [],
        isActive: true,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        _v: 1
      };
      tx.insert('medicines', newMed);
      return newMed;
    });
  },

  updateMedicine(id, data) {
    return db.transaction(tx => {
      const med = tx.getById('medicines', id);
      tx.update('medicines', id, {
        name: data.name !== undefined ? data.name : med.name,
        genericName: data.genericName !== undefined ? data.genericName : med.genericName,
        category: data.category !== undefined ? data.category : med.category,
        form: data.form !== undefined ? data.form : med.form,
        strength: data.strength !== undefined ? data.strength : med.strength,
        manufacturer: data.manufacturer !== undefined ? data.manufacturer : med.manufacturer,
        unitPrice: data.unitPrice !== undefined ? data.unitPrice : med.unitPrice,
        unitSize: data.unitSize !== undefined ? data.unitSize : med.unitSize,
        reorderLevel: data.reorderLevel !== undefined ? data.reorderLevel : med.reorderLevel,
        maxStock: data.maxStock !== undefined ? data.maxStock : med.maxStock,
        updatedAt: nowISO(),
        _v: med._v
      });
      return tx.getById('medicines', id);
    });
  },

  updateMedicineStatus(id, isActive) {
    return db.transaction(tx => {
      const med = tx.getById('medicines', id);
      tx.update('medicines', id, { isActive, updatedAt: nowISO(), _v: med._v });
      return tx.getById('medicines', id);
    });
  },

  /**
   * Restock a single medicine (inventory-level restock, independent of PO).
   * Automatically purges expired batches first.
   * Returns { expiredInfo, updatedMed } for UI feedback.
   */
  restockMedicine({ medicineId, quantity, batchNo, expiryDate, supplierId, poId, performedBy }) {
    if (!quantity || quantity <= 0) throw new DbError('Quantity must be greater than 0.', 'VALIDATION_ERROR');
    if (!expiryDate) throw new DbError('Expiry date is required.', 'VALIDATION_ERROR');
    if (!batchNo || !batchNo.trim()) throw new DbError('Batch number is required.', 'VALIDATION_ERROR');

    return db.transaction(tx => {
      const med = tx.getById('medicines', medicineId);

      // 1. Purge expired batches
      const { updatedBatches, removedCount, removedUnits } = purgeExpiredBatches(med.batches || []);

      // 2. Check max stock
      const currentStock = validBatches({ batches: updatedBatches }).reduce((s, b) => s + b.quantity, 0);
      if (med.maxStock && (currentStock + quantity) > med.maxStock) {
        const canAdd = med.maxStock - currentStock;
        throw new DbError(
          `Max stock limit (${med.maxStock}) would be exceeded. Current valid stock: ${currentStock}. You can add at most ${canAdd} units.`,
          'MAX_STOCK_ERROR'
        );
      }

      // 3. Add new batch
      const newBatch = {
        batchNo: batchNo.trim(),
        expiryDate,
        quantity,
        receivedDate: today(),
        supplierId: supplierId || null,
        poId: poId || null
      };
      const finalBatches = [...updatedBatches, newBatch];

      tx.update('medicines', medicineId, {
        batches: finalBatches,
        updatedAt: nowISO(),
        _v: med._v
      });

      // 4. Stock ledger entry
      tx.insert('stockLedger', {
        id: db.generateId('sl'),
        medicineId,
        batchNo: newBatch.batchNo,
        type: 'PURCHASE',
        quantity,
        referenceId: poId || null,
        note: poId ? 'PO Received (inventory restock)' : 'Manual restock',
        performedBy: performedBy || 'SYSTEM',
        createdAt: nowISO(),
        _v: 1
      });

      return {
        expiredInfo: { removedCount, removedUnits },
        updatedMed: tx.getById('medicines', medicineId)
      };
    });
  },

  /* ─────────────────────────────────────────────
     PRESCRIPTIONS / DISPENSING
  ───────────────────────────────────────────── */
  listPrescriptions(status) {
    let all = db.getAll('prescriptions');
    if (status) all = all.filter(p => p.status === status);
    return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  rejectPrescription(id, reason, pharmacistId) {
    if (!reason) throw new DbError('Reason required to reject prescription.', 'VALIDATION_ERROR');
    return db.transaction(tx => {
      const rx = tx.getById('prescriptions', id);
      if (rx.status !== 'PENDING') throw new DbError('Can only reject PENDING prescriptions.', 'INVALID_STATE');

      tx.update('prescriptions', id, {
        status: 'CANCELLED',
        notes: (rx.notes ? rx.notes + '\n' : '') + `Rejected by pharmacy: ${reason}`,
        updatedAt: nowISO(),
        _v: rx._v
      });

      const p = tx.getById('patients', rx.patientId);
      tx.insert('notifications', {
        id: db.generateId('notif'),
        type: 'RX_REJECTED',
        title: 'Prescription Rejected',
        message: `Pharmacy rejected Rx for ${p.name}. Reason: ${reason}`,
        targetRole: null,
        targetUserId: rx.doctorId,
        isRead: false,
        link: 'pages/doctor/prescriptions.html',
        createdAt: nowISO(),
        _v: 1
      });

      return tx.getById('prescriptions', id);
    });
  },

  /**
   * Dispense prescription with payment details.
   * payment: { status: 'PAID'|'UNPAID', method, transactionRef, amountReceived, insurer, claimNo }
   * Deducts stock FEFO from valid (non-expired) batches only.
   */
  dispense(id, pharmacistId, payment = {}) {
    return db.transaction(tx => {
      const rx = tx.getById('prescriptions', id);
      if (rx.status !== 'PENDING') throw new DbError('Can only dispense PENDING prescriptions.', 'INVALID_STATE');

      const billItems = [];
      let totalRxPrice = 0;
      const dispenseDetails = []; // for saving with prescription

      for (const item of rx.items) {
        const med = tx.getById('medicines', item.medicineId);
        const vb = validBatches(med);
        const available = vb.reduce((s, b) => s + b.quantity, 0);
        let qtyNeeded = item.quantity;

        if (available < qtyNeeded) {
          throw new DbError(
            `Insufficient valid stock for ${med.name}. Available (non-expired): ${available}, Needed: ${qtyNeeded}.`,
            'STOCK_ERROR'
          );
        }

        // FEFO deduction from valid batches
        const allBatches = [...med.batches];
        const sortedValid = [...vb]; // already sorted by expiry asc
        let usedBatchNo = sortedValid[0]?.batchNo || 'UNKNOWN';

        for (let i = 0; i < allBatches.length && qtyNeeded > 0; i++) {
          const b = allBatches[i];
          if (b.expiryDate < today() || b.quantity <= 0) continue;
          if (b.quantity <= qtyNeeded) {
            qtyNeeded -= b.quantity;
            allBatches[i] = { ...b, quantity: 0 };
          } else {
            allBatches[i] = { ...b, quantity: b.quantity - qtyNeeded };
            qtyNeeded = 0;
          }
        }

        tx.update('medicines', med.id, {
          batches: allBatches,
          updatedAt: nowISO(),
          _v: med._v
        });

        tx.insert('stockLedger', {
          id: db.generateId('sl'),
          medicineId: med.id,
          batchNo: usedBatchNo,
          type: 'DISPENSE',
          quantity: -item.quantity,
          referenceId: rx.id,
          note: `Dispensed to patient ${rx.patientId}`,
          performedBy: pharmacistId,
          createdAt: nowISO(),
          _v: 1
        });

        const unitPrice = med.unitPrice || med.price || 0;
        const itemTotal = unitPrice * item.quantity;
        totalRxPrice += itemTotal;
        billItems.push({
          description: `Pharmacy — ${med.name} (×${item.quantity})`,
          amount: itemTotal,
          type: 'pharmacy',
          referenceId: rx.id
        });

        dispenseDetails.push({
          medicineId: med.id,
          name: med.name,
          quantity: item.quantity,
          unitPrice,
          lineTotal: itemTotal
        });
      }

      // Determine bill/payment status
      const payStatus = payment.status === 'PAID' ? 'PAID' : 'UNPAID';
      const amtReceived = payment.amountReceived ? Math.round(parseFloat(payment.amountReceived) * 100) : 0;
      const paidAmount = payStatus === 'PAID' ? totalRxPrice : 0;

      const billStatus = payStatus === 'PAID' ? 'PAID' : 'UNPAID';

      // Create bill
      let billId = null;
      if (totalRxPrice > 0) {
        const bill = tx.insert('bills', {
          id: db.generateId('bill'),
          patientId: rx.patientId,
          items: billItems,
          totalAmount: totalRxPrice,
          paidAmount,
          status: billStatus,
          createdBy: pharmacistId,
          createdAt: nowISO(),
          updatedAt: nowISO(),
          _v: 1
        });
        billId = bill.id;

        // Create payment record if paid
        if (payStatus === 'PAID') {
          tx.insert('payments', {
            id: db.generateId('pay'),
            billId: bill.id,
            amount: paidAmount,
            method: payment.method || 'CASH',
            transactionRef: payment.transactionRef || null,
            receivedBy: pharmacistId,
            createdAt: nowISO(),
            _v: 1
          });
        }
      }

      // Update prescription with payment info
      tx.update('prescriptions', rx.id, {
        status: 'DISPENSED',
        dispensedBy: pharmacistId,
        dispensedAt: nowISO(),
        billId,
        payment: {
          status: payStatus,
          method: payment.method || null,
          transactionRef: payment.transactionRef || null,
          insurer: payment.insurer || null,
          claimNo: payment.claimNo || null,
          totalAmount: totalRxPrice,
          amountReceived,
          balance: amtReceived - totalRxPrice,
        },
        dispenseItems: dispenseDetails,
        updatedAt: nowISO(),
        _v: rx._v
      });

      return {
        prescription: tx.getById('prescriptions', rx.id),
        billId,
        totalAmount: totalRxPrice,
        balance: amtReceived - totalRxPrice
      };
    });
  },

  /* ─────────────────────────────────────────────
     SUPPLIERS
  ───────────────────────────────────────────── */
  listSuppliers() {
    return db.getAll('suppliers').sort((a, b) => a.name.localeCompare(b.name));
  },

  saveSupplier(data) {
    return db.transaction(tx => {
      if (data.id) {
        const s = tx.getById('suppliers', data.id);
        const updated = {
          ...s,
          name: data.name,
          contactPerson: data.contactPerson,
          phone: data.phone,
          email: data.email || '',
          address: data.address || s.address || '',
          rates: data.rates || s.rates || [],   // [{ medicineId, rate }]
          // Keep typicalMedicines for schema compat but don't expose in UI
          typicalMedicines: s.typicalMedicines || [],
          updatedAt: nowISO(),
          _v: s._v
        };
        tx.update('suppliers', data.id, updated);
        return tx.getById('suppliers', data.id);
      } else {
        const newSupplier = {
          id: db.generateId('sup'),
          name: data.name,
          contactPerson: data.contactPerson,
          phone: data.phone,
          email: data.email || '',
          address: data.address || '',
          rates: data.rates || [],
          typicalMedicines: [],
          isActive: true,
          createdAt: nowISO(),
          updatedAt: nowISO(),
          _v: 1
        };
        tx.insert('suppliers', newSupplier);
        return tx.getById('suppliers', newSupplier.id);
      }
    });
  },

  /** Get rates for a given supplier, enriched with medicine names. */
  getSupplierRates(supplierId) {
    const sup = db.getById('suppliers', supplierId);
    const rates = sup.rates || [];
    return rates.map(r => {
      try {
        const med = db.getById('medicines', r.medicineId);
        return { ...r, medicineName: med.name };
      } catch {
        return { ...r, medicineName: '(Unknown)' };
      }
    });
  },

  /* ─────────────────────────────────────────────
     PURCHASE ORDERS
  ───────────────────────────────────────────── */
  listPurchases() {
    return db.getAll('purchaseOrders').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  createPurchaseOrder(data, pharmacistId) {
    if (!data.supplierId) throw new DbError('Supplier is required.', 'VALIDATION_ERROR');
    if (!data.items || data.items.length === 0) throw new DbError('At least one medicine is required.', 'VALIDATION_ERROR');

    const totalAmount = data.items.reduce((s, i) => s + (i.unitCost * i.quantityOrdered), 0);
    const orderDate = data.orderDate || today();

    return db.transaction(tx => {
      const po = {
        id: db.generateId('po'),
        supplierId: data.supplierId,
        items: data.items.map(i => ({
          medicineId: i.medicineId,
          name: i.name || '',
          quantityOrdered: i.quantityOrdered,
          quantityReceived: 0,
          unitCost: i.unitCost  // paise
        })),
        status: 'ORDERED',
        totalAmount,          // required by schema
        orderDate,            // required by schema
        expectedDate: data.expectedDate || null,
        receivedDate: null,
        notes: data.notes || null,
        createdBy: pharmacistId,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        _v: 1
      };
      tx.insert('purchaseOrders', po);
      return po;
    });
  },

  receivePurchaseOrder(id, receivedItems, pharmacistId) {
    return db.transaction(tx => {
      const po = tx.getById('purchaseOrders', id);
      if (po.status === 'RECEIVED' || po.status === 'CANCELLED') {
        throw new DbError('PO cannot be received.', 'INVALID_STATE');
      }

      let allReceived = true;
      const updatedItems = [];

      for (const poItem of po.items) {
        const recv = receivedItems.find(r => r.medicineId === poItem.medicineId);
        let newReceivedQty = poItem.quantityReceived || 0;

        if (recv && recv.quantity > 0) {
          const med = tx.getById('medicines', poItem.medicineId);

          // Purge expired batches first
          const { updatedBatches, removedCount, removedUnits } = purgeExpiredBatches(med.batches || []);

          // Check max stock
          const currentStock = validBatches({ batches: updatedBatches }).reduce((s, b) => s + b.quantity, 0);
          if (med.maxStock && (currentStock + recv.quantity) > med.maxStock) {
            const canAdd = med.maxStock - currentStock;
            throw new DbError(
              `Max stock limit for ${med.name} (${med.maxStock}) would be exceeded. Can add at most ${canAdd} units.`,
              'MAX_STOCK_ERROR'
            );
          }

          const newBatch = {
            batchNo: recv.batchNumber || recv.batchNo || `B-${Date.now().toString().slice(-6)}`,
            expiryDate: recv.expiryDate,
            quantity: recv.quantity,
            receivedDate: today(),
            supplierId: po.supplierId,
            poId: po.id
          };

          tx.update('medicines', med.id, {
            batches: [...updatedBatches, newBatch],
            updatedAt: nowISO(),
            _v: med._v
          });

          tx.insert('stockLedger', {
            id: db.generateId('sl'),
            medicineId: med.id,
            batchNo: newBatch.batchNo,
            type: 'PURCHASE',
            quantity: recv.quantity,
            referenceId: po.id,
            note: 'PO Received',
            performedBy: pharmacistId,
            createdAt: nowISO(),
            _v: 1
          });

          newReceivedQty += recv.quantity;
        }

        updatedItems.push({ ...poItem, quantityReceived: newReceivedQty });
        if (newReceivedQty < poItem.quantityOrdered) allReceived = false;
      }

      tx.update('purchaseOrders', id, {
        items: updatedItems,
        status: allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
        receivedDate: today(),
        updatedAt: nowISO(),
        _v: po._v
      });

      return tx.getById('purchaseOrders', id);
    });
  },

  /* ─────────────────────────────────────────────
     STOCK ALERTS
  ───────────────────────────────────────────── */
  getStockAlerts() {
    const meds = db.getAll('medicines').filter(m => m.isActive);
    const t = today();
    const ninetyDays = new Date(new Date().getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const alerts = [];

    meds.forEach(m => {
      const vb = validBatches(m);
      const stock = vb.reduce((s, b) => s + b.quantity, 0);

      if (stock <= m.reorderLevel) {
        alerts.push({ id: m.id, name: m.name, type: 'LOW_STOCK', stockLevel: stock, reorderLevel: m.reorderLevel });
      }

      // Expiring soon (within 90 days, non-expired)
      vb.forEach(b => {
        if (b.expiryDate <= ninetyDays) {
          alerts.push({ id: m.id, name: m.name, type: 'EXPIRY', expiryDate: b.expiryDate, batchQty: b.quantity, batchNo: b.batchNo });
        }
      });

      // Expired batches with qty > 0
      (m.batches || []).filter(b => b.expiryDate < t && b.quantity > 0).forEach(b => {
        alerts.push({ id: m.id, name: m.name, type: 'EXPIRED', expiryDate: b.expiryDate, batchQty: b.quantity, batchNo: b.batchNo });
      });
    });

    return alerts;
  }
};
