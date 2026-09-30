/**
 * Clinova Healthcare — Pharmacy API
 * Business logic for inventory, dispensing, and purchasing.
 */

import { db, DbError } from '../data/db.js';

export const pharmacy = {
  // Helper to dynamically calculate stock from active batches
  getStockLevel(medicine) {
    if (!medicine || !medicine.batches) return 0;
    return medicine.batches.reduce((total, batch) => total + batch.quantity, 0);
  },

  // --- Inventory ---
  listMedicines() {
    return db.getAll('medicines').sort((a, b) => a.name.localeCompare(b.name));
  },
  
  addMedicine(data) {
    return db.transaction(tx => {
      const newMed = {
        id: db.generateId('med'),
        name: data.name,
        genericName: data.genericName,
        category: data.category,
        unit: data.unit,
        price: data.price, // paise
        reorderLevel: data.reorderLevel,
        isActive: true,
        batches: [], // { batchNumber, expiryDate, quantity }
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _v: 1
      };
      tx.insert('medicines', newMed);
      return newMed;
    });
  },

  updateMedicineStatus(id, isActive) {
    return db.transaction(tx => {
      const med = tx.getById('medicines', id);
      tx.update('medicines', id, { isActive, updatedAt: new Date().toISOString(), _v: med._v });
      return tx.getById('medicines', id);
    });
  },

  // --- Dispensing ---
  listPrescriptions(status) {
    let all = db.getAll('prescriptions');
    if (status) all = all.filter(p => p.status === status);
    // Queue should show oldest first
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
        updatedAt: new Date().toISOString(),
        _v: rx._v
      });

      // Notify Doctor
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
        createdAt: new Date().toISOString(),
        _v: 1
      });

      return tx.getById('prescriptions', id);
    });
  },

  dispense(id, pharmacistId) {
    return db.transaction(tx => {
      const rx = tx.getById('prescriptions', id);
      if (rx.status !== 'PENDING') throw new DbError('Can only dispense PENDING prescriptions.', 'INVALID_STATE');

      const billItems = [];
      let totalRxPrice = 0;

      // Deduct stock using oldest-expiry-first (FIFO on expiry)
      for (const item of rx.items) {
        const med = tx.getById('medicines', item.medicineId);
        let qtyNeeded = item.quantity;
        const currentStock = pharmacy.getStockLevel(med);
        
        if (currentStock < qtyNeeded) {
          throw new DbError(`Insufficient stock for ${med.name}. Available: ${currentStock}, Needed: ${qtyNeeded}.`, 'STOCK_ERROR');
        }

        // Sort batches by expiry ascending (earliest to expire first)
        const batches = [...med.batches].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
        const updatedBatches = [];

        for (const batch of batches) {
          if (qtyNeeded === 0) {
            updatedBatches.push(batch);
            continue;
          }
          if (batch.quantity <= qtyNeeded) {
            qtyNeeded -= batch.quantity;
            // Batch exhausted, don't push it
          } else {
            batch.quantity -= qtyNeeded;
            qtyNeeded = 0;
            updatedBatches.push(batch);
          }
        }

        // Update medicine batches
        tx.update('medicines', med.id, {
          batches: updatedBatches,
          updatedAt: new Date().toISOString(),
          _v: med._v
        });

        // Record dispensing history to stockLedger
        tx.insert('stockLedger', {
          id: db.generateId('sl'),
          medicineId: med.id,
          batchNo: batches[0].batchNo, // using first batch for ledger simplicity
          type: 'DISPENSE',
          quantity: -item.quantity, // negative for dispense
          referenceId: rx.id,
          note: `Dispensed to patient ${rx.patientId}`,
          performedBy: pharmacistId,
          createdAt: new Date().toISOString(),
          _v: 1
        });

        const itemTotal = med.price * item.quantity;
        totalRxPrice += itemTotal;
        billItems.push({
          description: `Pharmacy — ${med.name} (x${item.quantity})`,
          amount: itemTotal,
          type: 'pharmacy',
          referenceId: rx.id
        });
      }

      // Update prescription status
      tx.update('prescriptions', rx.id, {
        status: 'DISPENSED',
        dispensedBy: pharmacistId,
        dispensedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _v: rx._v
      });

      // Add to patient's bill
      if (totalRxPrice > 0) {
        tx.insert('bills', {
          id: db.generateId('bill'),
          patientId: rx.patientId,
          items: billItems,
          totalAmount: totalRxPrice,
          paidAmount: 0,
          status: 'UNPAID',
          createdBy: pharmacistId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _v: 1
        });
      }

      return tx.getById('prescriptions', id);
    });
  },

  // --- Suppliers ---
  listSuppliers() {
    return db.getAll('suppliers').sort((a, b) => a.name.localeCompare(b.name));
  },
  
  saveSupplier(data) {
    return db.transaction(tx => {
      if (data.id) {
        const s = tx.getById('suppliers', data.id);
        const updated = { ...s, ...data, updatedAt: new Date().toISOString(), _v: s._v };
        tx.update('suppliers', data.id, updated);
        return updated;
      } else {
        const newSupplier = {
          id: db.generateId('sup'),
          ...data,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _v: 1
        };
        tx.insert('suppliers', newSupplier);
        return newSupplier;
      }
    });
  },

  // --- Purchasing ---
  listPurchases() {
    return db.getAll('purchaseOrders').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  createPurchaseOrder(data, pharmacistId) {
    return db.transaction(tx => {
      const po = {
        id: db.generateId('po'),
        supplierId: data.supplierId,
        items: data.items.map(i => ({
          medicineId: i.medicineId,
          quantityOrdered: i.quantity,
          quantityReceived: 0,
          pricePerUnit: i.pricePerUnit
        })),
        status: 'ORDERED', // Skipping DRAFT for simplicity
        createdBy: pharmacistId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _v: 1
      };
      tx.insert('purchaseOrders', po);
      return po;
    });
  },

  receivePurchaseOrder(id, receivedItems, pharmacistId) {
    return db.transaction(tx => {
      const po = tx.getById('purchaseOrders', id);
      if (po.status === 'RECEIVED' || po.status === 'CANCELLED') throw new DbError('PO cannot be received.', 'INVALID_STATE');

      let allReceived = true;
      const updatedItems = [];

      for (const poItem of po.items) {
        const recv = receivedItems.find(r => r.medicineId === poItem.medicineId);
        let newReceivedQty = poItem.quantityReceived;

        if (recv && recv.quantity > 0) {
          const med = tx.getById('medicines', poItem.medicineId);
          
          // Update Medicine Batch and Stock
          const newBatch = {
            batchNumber: recv.batchNumber || `B-${Date.now().toString().slice(-6)}`,
            expiryDate: recv.expiryDate,
            quantity: recv.quantity
          };
          
          tx.update('medicines', med.id, {
            batches: [...med.batches, newBatch],
            updatedAt: new Date().toISOString(),
            _v: med._v
          });

          // Ledger Entry
          tx.insert('stockLedger', {
            id: db.generateId('sl'),
            medicineId: med.id,
            batchNo: newBatch.batchNumber,
            type: 'PURCHASE',
            quantity: recv.quantity,
            referenceId: po.id,
            note: 'PO Received',
            performedBy: pharmacistId,
            createdAt: new Date().toISOString(),
            _v: 1
          });

          newReceivedQty += recv.quantity;
        }

        updatedItems.push({ ...poItem, quantityReceived: newReceivedQty });
        if (newReceivedQty < poItem.quantityOrdered) {
          allReceived = false;
        }
      }

      tx.update('purchaseOrders', id, {
        items: updatedItems,
        status: allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
        updatedAt: new Date().toISOString(),
        _v: po._v
      });

      return tx.getById('purchaseOrders', id);
    });
  }
};
