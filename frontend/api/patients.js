/**
 * Clinova Healthcare — Patients API
 * Business logic for patient management.
 */

import { db, DbError } from '../data/db.js';

export const patients = {
  /**
   * List patients with optional search query.
   */
  list(searchQuery = '') {
    const all = db.getAll('patients');
    if (!searchQuery) return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    
    const q = searchQuery.toLowerCase();
    return all.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.mrn.toLowerCase().includes(q) ||
      (p.phone && p.phone.includes(q))
    ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  /**
   * Get patient by ID.
   */
  getById(id) {
    return db.getById('patients', id);
  },

  /**
   * Register a new patient.
   * Enforces rules: Duplicate checks, Guardian for under 18.
   */
  register(data, createdBy) {
    return db.transaction(tx => {
      // 1. Guardian check
      const age = this.calculateAge(data.dateOfBirth);
      if (age < 18 && (!data.guardianName || !data.guardianPhone)) {
        throw new DbError('Patients under 18 require guardian details.', 'VALIDATION_ERROR');
      }

      // 2. Duplicate check (Phone or Name+DOB)
      const existing = tx.getAll('patients');
      const isDuplicate = existing.some(p => {
        if (data.phone && p.phone === data.phone) return true;
        if (p.name.toLowerCase() === data.name.toLowerCase() && p.dateOfBirth === data.dateOfBirth) return true;
        return false;
      });

      if (isDuplicate) {
        throw new DbError('A patient with this phone number or name/DOB combination already exists.', 'DUPLICATE_PATIENT');
      }

      // 3. Generate MRN (CLN-YYYY-XXXX)
      const year = new Date().getFullYear();
      const yearPatients = existing.filter(p => p.mrn.startsWith(`CLN-${year}`));
      const sequence = String(yearPatients.length + 1).padStart(4, '0');
      const mrn = `CLN-${year}-${sequence}`;

      // 4. Create record
      const newPatient = {
        id: db.generateId('pat'),
        mrn,
        name: data.name,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address,
        bloodGroup: data.bloodGroup || null,
        allergies: data.allergies || [],
        chronicConditions: data.chronicConditions || [],
        guardianName: data.guardianName || null,
        guardianPhone: data.guardianPhone || null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _v: 1
      };

      tx.insert('patients', newPatient);
      return newPatient;
    });
  },

  /**
   * Helper: Calculate age from DOB string (YYYY-MM-DD)
   */
  calculateAge(dobString) {
    const today = new Date();
    const birthDate = new Date(dobString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }
};
