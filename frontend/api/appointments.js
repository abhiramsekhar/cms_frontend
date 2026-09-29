/**
 * Clinova Healthcare — Appointments API
 * Business logic for booking and managing appointments.
 */

import { db, DbError } from '../data/db.js';
import { billing } from './billing.js';

export const appointments = {
  /**
   * List appointments, optionally filtered by date and doctor.
   */
  list(filters = {}) {
    let all = db.getAll('appointments');
    
    if (filters.date) {
      all = all.filter(a => a.date === filters.date);
    }
    if (filters.doctorId) {
      all = all.filter(a => a.doctorId === filters.doctorId);
    }
    if (filters.patientId) {
      all = all.filter(a => a.patientId === filters.patientId);
    }
    if (filters.status) {
      all = all.filter(a => a.status === filters.status);
    }
    
    return all.sort((a, b) => {
      // Sort by date then time
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });
  },

  /**
   * Get appointment by ID.
   */
  getById(id) {
    return db.getById('appointments', id);
  },

  /**
   * Book a new appointment.
   * Checks for slot availability and creates a consultation bill.
   */
  book(data, createdBy) {
    return db.transaction(tx => {
      // 1. Check for slot conflict
      const existing = tx.getAll('appointments').filter(a => 
        a.doctorId === data.doctorId && 
        a.date === data.date && 
        a.time === data.time &&
        a.status !== 'CANCELLED'
      );

      if (existing.length > 0) {
        throw new DbError('This time slot is already booked for the selected doctor.', 'SLOT_UNAVAILABLE');
      }

      // 2. Determine token number for the day
      const dayAppts = tx.getAll('appointments').filter(a => 
        a.doctorId === data.doctorId && a.date === data.date
      );
      const tokenNumber = dayAppts.length + 1;

      // 3. Get doctor's department
      const doctor = tx.getById('staff', data.doctorId);

      // 4. Create appointment
      const newAppt = {
        id: db.generateId('appt'),
        patientId: data.patientId,
        doctorId: data.doctorId,
        departmentId: doctor.departmentId,
        date: data.date,
        time: data.time,
        type: data.type || 'New Visit',
        status: 'SCHEDULED',
        reason: data.reason,
        notes: null,
        tokenNumber,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _v: 1
      };

      tx.insert('appointments', newAppt);

      // 5. Automatically bill consultation fee (e.g., 500 INR = 50000 paise)
      // We do this by calling the billing API directly within the transaction.
      // Wait, we can't easily nest tx. We will construct the bill manually here to be safe inside the same tx.
      const newBill = {
        id: db.generateId('bill'),
        patientId: data.patientId,
        items: [
          {
            description: `Consultation — ${data.type || 'New Visit'}`,
            amount: 50000, // 500 INR
            type: 'consultation',
            referenceId: newAppt.id
          }
        ],
        totalAmount: 50000,
        paidAmount: 0,
        status: 'UNPAID',
        createdBy: createdBy,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _v: 1
      };
      tx.insert('bills', newBill);

      return newAppt;
    });
  },

  /**
   * Cancel an appointment.
   * Requires a reason. Also cancels associated unpaid consultation bill.
   */
  cancel(id, reason, cancelledBy) {
    if (!reason) throw new DbError('A cancellation reason is required.', 'VALIDATION_ERROR');

    return db.transaction(tx => {
      const appt = tx.getById('appointments', id);
      if (['COMPLETED', 'IN_PROGRESS', 'CANCELLED'].includes(appt.status)) {
        throw new DbError(`Cannot cancel an appointment with status ${appt.status}.`, 'INVALID_STATE');
      }

      // Update appointment
      const updated = {
        ...appt,
        status: 'CANCELLED',
        notes: (appt.notes ? appt.notes + '\n' : '') + `Cancelled by ${cancelledBy}: ${reason}`,
        updatedAt: new Date().toISOString(),
        _v: appt._v
      };
      tx.update('appointments', id, updated);

      // Try to find and cancel the unpaid bill
      const bills = tx.getAll('bills').filter(b => b.patientId === appt.patientId && b.status === 'UNPAID');
      for (const b of bills) {
        const hasConsultFee = b.items.some(i => i.referenceId === appt.id);
        if (hasConsultFee) {
          tx.update('bills', b.id, { 
            status: 'CANCELLED', 
            updatedAt: new Date().toISOString(), 
            _v: b._v 
          });
        }
      }

      return updated;
    });
  },

  /**
   * Update status (e.g. CHECKED_IN, NO_SHOW).
   */
  updateStatus(id, status) {
    return db.transaction(tx => {
      const appt = tx.getById('appointments', id);
      tx.update('appointments', id, {
        status,
        updatedAt: new Date().toISOString(),
        _v: appt._v
      });
      return tx.getById('appointments', id);
    });
  }
};
