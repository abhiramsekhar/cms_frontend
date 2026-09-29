/**
 * Clinova Healthcare — Billing API
 * Business logic for invoices and payments.
 */

import { db, DbError } from '../data/db.js';

export const billing = {
  /**
   * List bills, optionally by patient.
   */
  list(filters = {}) {
    let all = db.getAll('bills');
    if (filters.patientId) all = all.filter(b => b.patientId === filters.patientId);
    if (filters.status) all = all.filter(b => b.status === filters.status);
    
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  /**
   * Get bill by ID.
   */
  getById(id) {
    return db.getById('bills', id);
  },

  /**
   * Receive payment for a bill.
   */
  receivePayment(billId, amount, method, receivedBy) {
    return db.transaction(tx => {
      const bill = tx.getById('bills', billId);
      
      if (['PAID', 'CANCELLED'].includes(bill.status)) {
        throw new DbError(`Cannot pay a bill that is ${bill.status}.`, 'INVALID_STATE');
      }

      if (amount <= 0) {
        throw new DbError('Payment amount must be greater than zero.', 'VALIDATION_ERROR');
      }

      const balance = bill.totalAmount - bill.paidAmount;
      if (amount > balance) {
        throw new DbError(`Payment amount exceeds balance due (₹${(balance/100).toFixed(2)}).`, 'VALIDATION_ERROR');
      }

      // Record payment
      const payment = {
        id: db.generateId('pay'),
        billId: bill.id,
        amount: amount,
        method: method,
        receivedBy: receivedBy,
        createdAt: new Date().toISOString(),
        _v: 1
      };
      tx.insert('payments', payment);

      // Update bill
      const newPaidAmount = bill.paidAmount + amount;
      const newStatus = newPaidAmount >= bill.totalAmount ? 'PAID' : 'PARTIAL';
      
      tx.update('bills', bill.id, {
        paidAmount: newPaidAmount,
        status: newStatus,
        updatedAt: new Date().toISOString(),
        _v: bill._v
      });

      return tx.getById('bills', bill.id);
    });
  }
};
