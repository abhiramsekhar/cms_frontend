/**
 * Clinova Healthcare — Laboratory API
 * Business logic for ordering lab tests (standalone or via consultation).
 */

import { db, DbError } from '../data/db.js';

export const laboratory = {
  /**
   * Get the catalog of available tests.
   */
  getCatalog() {
    return db.getAll('labCatalog').filter(t => t.isActive).sort((a, b) => a.name.localeCompare(b.name));
  },

  /**
   * List lab orders by doctor or patient.
   */
  listOrders(filters = {}) {
    let all = db.getAll('labOrders');
    if (filters.doctorId) all = all.filter(o => o.doctorId === filters.doctorId);
    if (filters.patientId) all = all.filter(o => o.patientId === filters.patientId);
    if (filters.status) all = all.filter(o => o.status === filters.status);
    
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  /**
   * Order a lab test.
   * Can be linked to a consultation or standalone.
   */
  orderTest(data) {
    return db.transaction(tx => {
      const test = tx.getById('labCatalog', data.testId);
      const patient = tx.getById('patients', data.patientId);

      const newOrder = {
        id: db.generateId('lab'),
        consultationId: data.consultationId || null,
        patientId: data.patientId,
        doctorId: data.doctorId,
        testId: data.testId,
        status: 'ORDERED',
        priority: data.priority || 'Routine',
        results: null,
        isCritical: false,
        technicianId: null,
        sampleCollectedAt: null,
        completedAt: null,
        notes: data.notes || null, // Stores clinical reason for standalone
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _v: 1
      };

      tx.insert('labOrders', newOrder);

      // Create notification for Lab Techs
      tx.insert('notifications', {
        id: db.generateId('notif'),
        type: 'LAB_ORDER',
        title: `New Lab Order: ${data.priority === 'Urgent' || data.priority === 'Stat' ? 'URGENT - ' : ''}${test.code}`,
        message: `Test ${test.name} ordered for ${patient.name}.`,
        targetRole: 'LAB_TECH',
        targetUserId: null,
        isRead: false,
        link: 'pages/lab/test-queue.html',
        createdAt: new Date().toISOString(),
        _v: 1
      });

      // Generate a bill for the test
      const newBill = {
        id: db.generateId('bill'),
        patientId: data.patientId,
        items: [
          {
            description: `Lab Test — ${test.name}`,
            amount: test.price,
            type: 'lab',
            referenceId: newOrder.id
          }
        ],
        totalAmount: test.price,
        paidAmount: 0,
        status: 'UNPAID',
        createdBy: data.doctorId, // Doctor initiated
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _v: 1
      };
      tx.insert('bills', newBill);

      return newOrder;
    });
  },

  /**
   * Update the status of a lab order (e.g. SAMPLE_COLLECTED, PROCESSING)
   */
  updateStatus(id, status, techId) {
    return db.transaction(tx => {
      const order = tx.getById('labOrders', id);
      const updates = { status, technicianId: techId, updatedAt: new Date().toISOString(), _v: order._v };
      if (status === 'SAMPLE_COLLECTED' && !order.sampleCollectedAt) {
        updates.sampleCollectedAt = updates.updatedAt;
      }
      tx.update('labOrders', id, updates);
      return tx.getById('labOrders', id);
    });
  },

  /**
   * Enter results for a lab order and complete it.
   */
  enterResult(id, resultsData, techId) {
    return db.transaction(tx => {
      const order = tx.getById('labOrders', id);
      if (order.status === 'COMPLETED') throw new DbError('Order is already completed.', 'INVALID_STATE');

      const test = tx.getById('labCatalog', order.testId);
      const patient = tx.getById('patients', order.patientId);

      let isCritical = false;
      const formattedResults = [];

      // Evaluate each parameter against reference ranges
      for (const param of test.parameters) {
        const val = parseFloat(resultsData[param.name]);
        if (isNaN(val)) throw new DbError(`Invalid value for ${param.name}`, 'VALIDATION_ERROR');

        let flag = 'Normal';
        let paramCritical = false;

        if (param.min != null && val < param.min) { flag = 'Low'; }
        else if (param.max != null && val > param.max) { flag = 'High'; }

        if (param.criticalMin != null && val <= param.criticalMin) { flag = 'Critical'; paramCritical = true; }
        if (param.criticalMax != null && val >= param.criticalMax) { flag = 'Critical'; paramCritical = true; }

        if (paramCritical) isCritical = true;

        formattedResults.push({
          parameter: param.name,
          value: val,
          unit: param.unit,
          referenceRange: `${param.min || ''} - ${param.max || ''} ${param.unit}`,
          flag,
          isAbnormal: flag !== 'Normal'
        });
      }

      const updates = {
        status: 'COMPLETED',
        results: formattedResults,
        isCritical,
        technicianId: techId,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _v: order._v
      };

      tx.update('labOrders', id, updates);

      // If critical, notify ordering doctor immediately
      if (isCritical) {
        tx.insert('notifications', {
          id: db.generateId('notif'),
          type: 'CRITICAL_RESULT',
          title: 'CRITICAL LAB RESULT',
          message: `Critical result for ${patient.name} (${test.name}).`,
          targetRole: null,
          targetUserId: order.doctorId,
          isRead: false,
          link: `pages/doctor/lab-orders.html`,
          createdAt: new Date().toISOString(),
          _v: 1
        });
      }

      return tx.getById('labOrders', id);
    });
  },

  /**
   * Cancel an ORDERED lab test.
   */
  cancel(id) {
    return db.transaction(tx => {
      const order = tx.getById('labOrders', id);
      if (order.status !== 'ORDERED') {
        throw new DbError('Only ORDERED lab tests can be cancelled.', 'INVALID_STATE');
      }

      tx.update('labOrders', id, {
        status: 'CANCELLED',
        updatedAt: new Date().toISOString(),
        _v: order._v
      });

      // Also cancel the bill
      const bill = tx.findOne('bills', b => b.status === 'UNPAID' && b.patientId === order.patientId &&
        b.items.some(i => i.referenceId === order.id));
      if (bill) {
        tx.update('bills', bill.id, {
          status: 'CANCELLED',
          updatedAt: new Date().toISOString(),
          _v: bill._v
        });
      }

      return tx.getById('labOrders', id);
    });
  }
};
