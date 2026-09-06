import { describe, it, expect } from 'vitest';
import {
  ROLE_DEFINITIONS,
  permissionsForRoles,
  hasPermission,
  canEditClinicalRecord,
  assertDoubleWitness,
  assertPositionAvailable,
  assertPaymentAmount,
  assertSufficientStock,
  fefoOrder,
  lineTotals,
  nameKey,
  looksLikeDuplicate,
  gradeBlastocyst,
  assertValidDateOfBirth
} from '../src/index.js';

describe('RBAC', () => {
  it('wildcard passes any permission', () => {
    expect(hasPermission({ permissions: ['*'] }, 'patient:create')).toBe(true);
  });
  it('flattens role permissions', () => {
    const perms = permissionsForRoles(['RECEPTIONIST']);
    expect(perms).toContain('patient:create');
    expect(perms).not.toContain('finance:refund');
  });
  it('administrator has full control', () => {
    expect(permissionsForRoles(['SYSTEM_ADMINISTRATOR'])).toEqual(['*']);
  });
  it('enforces author-only draft editing', () => {
    expect(canEditClinicalRecord({ permissions: ['clinical_record:update'], userId: 'u1' }, { userId: 'u1', isAuthor: true, recordSigned: false })).toBe(true);
    expect(canEditClinicalRecord({ permissions: ['clinical_record:update'], userId: 'u2' }, { userId: 'u2', isAuthor: false, recordSigned: false })).toBe(false);
  });
});

describe('Double witness', () => {
  it('requires two distinct users', () => {
    expect(assertDoubleWitness({ primaryUserId: 'a', witnessUserId: 'a' }).ok).toBe(false);
    expect(assertDoubleWitness({ primaryUserId: 'a', witnessUserId: 'b', status: 'VERIFIED' }).ok).toBe(true);
    expect(assertDoubleWitness({ primaryUserId: 'a', witnessUserId: 'b', status: 'PENDING' }).ok).toBe(false);
  });
});

describe('Cryostorage', () => {
  it('blocks double occupancy', () => {
    const r = assertPositionAvailable({ positionId: 'p', occupiedByItemId: 'other' }, 'mine');
    expect(r.ok).toBe(false);
    expect(assertPositionAvailable({ positionId: 'p', occupiedByItemId: null }, 'mine').ok).toBe(true);
  });
});

describe('Finance rules', () => {
  it('computes line totals (gross -> discount -> tax)', () => {
    const t = lineTotals({ unitPrice: 100, quantity: 2, discountAmount: 20, taxRate: 0.1 });
    expect(t.gross).toBe(200);
    expect(t.discountAmount).toBe(20);
    expect(t.taxAmount).toBe(18);
    expect(t.lineTotal).toBe(198);
  });
  it('rejects overpayment', () => {
    expect(assertPaymentAmount(100, 101).ok).toBe(false);
    expect(assertPaymentAmount(100, 100).ok).toBe(true);
  });
});

describe('Inventory rules', () => {
  it('rejects insufficient stock', () => {
    expect(assertSufficientStock({ quantityOnHand: 5 }, 6).ok).toBe(false);
    expect(assertSufficientStock({ quantityOnHand: 5 }, 5).ok).toBe(true);
  });
  it('orders batches FEFO', () => {
    const order = fefoOrder([
      { id: 'late', expiryDate: '2027-01-01', batchNumber: 'B' },
      { id: 'early', expiryDate: '2026-01-01', batchNumber: 'A' },
      { id: 'none', expiryDate: null, batchNumber: 'C' }
    ]);
    expect(order).toEqual(['early', 'late', 'none']);
  });
});

describe('Patient rules', () => {
  it('normalizes name keys', () => {
    expect(nameKey('José', 'García')).toBe('jose|garcia');
  });
  it('detects duplicates by name or phone', () => {
    expect(looksLikeDuplicate({ nameKey: 'a|b', phone: '111' }, { nameKey: 'a|b', phone: '222' })).toBe(true);
    expect(looksLikeDuplicate({ nameKey: 'a|b', phone: '+255 712 000 000' }, { nameKey: 'x|y', phone: '255712000000' })).toBe(true);
  });
  it('rejects implausible dates of birth', () => {
    expect(assertValidDateOfBirth('1990-01-01').ok).toBe(true);
    expect(assertValidDateOfBirth('not-a-date').ok).toBe(false);
    expect(assertValidDateOfBirth('3010-01-01').ok).toBe(false);
  });
});

describe('Embryology', () => {
  it('grades a good blastocyst', () => {
    const g = gradeBlastocyst({ blastocystStage: 5, innerCellMass: 'A', trophectoderm: 'A' });
    expect(g.quality).toBe('GOOD');
    expect(g.grade).toBe('5AA');
  });
  it('grades a poor early embryo', () => {
    const g = gradeBlastocyst({ blastocystStage: 2, innerCellMass: 'C', trophectoderm: 'C' });
    expect(g.quality).toBe('POOR');
  });
});

describe('Role definitions', () => {
  it('all default roles are defined', () => {
    expect(Object.keys(ROLE_DEFINITIONS)).toHaveLength(20);
  });
});
