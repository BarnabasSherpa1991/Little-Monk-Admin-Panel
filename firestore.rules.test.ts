/**
 * Security Rules Verification Suite (Phase 0 TDD Spec)
 * Verifies the "Dirty Dozen" adversarial payloads and authorized CRM flows
 * against DRAFT_firestore.rules / firestore.rules.
 */

export interface SecurityTestCase {
  id: string;
  name: string;
  expected: 'PERMISSION_DENIED' | 'ALLOW';
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  description: string;
}

export const DIRTY_DOZEN_TEST_CASES: SecurityTestCase[] = [
  {
    id: 'DD-01',
    name: 'Unauthenticated Read',
    expected: 'PERMISSION_DENIED',
    collection: 'enquiries',
    operation: 'list',
    description: 'Anonymous/unauthenticated request must be denied across all collections.'
  },
  {
    id: 'DD-02',
    name: 'Unverified Email Spoof',
    expected: 'PERMISSION_DENIED',
    collection: 'employees',
    operation: 'create',
    description: 'Auth token with admin email but email_verified === false must be rejected.'
  },
  {
    id: 'DD-03',
    name: 'Self-Role Escalation on Create',
    expected: 'PERMISSION_DENIED',
    collection: 'employees',
    operation: 'create',
    description: 'Uninvited user cannot create an employee record with Super Admin role.'
  },
  {
    id: 'DD-04',
    name: 'Self-Role Escalation on Update',
    expected: 'PERMISSION_DENIED',
    collection: 'employees',
    operation: 'update',
    description: 'Non-admin employee cannot modify role, status, or permissions fields.'
  },
  {
    id: 'DD-05',
    name: 'Shadow / Ghost Field Injection',
    expected: 'PERMISSION_DENIED',
    collection: 'enquiries',
    operation: 'create',
    description: 'Payload containing undeclared fields must fail keys().hasOnly() validation.'
  },
  {
    id: 'DD-06',
    name: 'ID Poisoning (Oversized Path ID)',
    expected: 'PERMISSION_DENIED',
    collection: 'enquiries',
    operation: 'create',
    description: 'Document ID exceeding 128 characters must fail isValidId().'
  },
  {
    id: 'DD-07',
    name: 'ID Character Injection',
    expected: 'PERMISSION_DENIED',
    collection: 'enquiries',
    operation: 'create',
    description: 'Document ID with special symbols must fail regex ^[a-zA-Z0-9_\\-]+$.'
  },
  {
    id: 'DD-08',
    name: 'Payload Exhaustion (Oversized String)',
    expected: 'PERMISSION_DENIED',
    collection: 'enquiries',
    operation: 'create',
    description: 'String fields exceeding blueprint maxLength must be rejected.'
  },
  {
    id: 'DD-09',
    name: 'Identity Spoofing on Create',
    expected: 'PERMISSION_DENIED',
    collection: 'enquiries',
    operation: 'create',
    description: 'createdByUid must strictly equal request.auth.uid.'
  },
  {
    id: 'DD-10',
    name: 'Immutable Field Tampering',
    expected: 'PERMISSION_DENIED',
    collection: 'bookings',
    operation: 'update',
    description: 'Updating createdAt or createdByUid must be denied.'
  },
  {
    id: 'DD-11',
    name: 'Timestamp Forgery',
    expected: 'PERMISSION_DENIED',
    collection: 'bookings',
    operation: 'create',
    description: 'Client-supplied timestamp not equal to request.time must be rejected.'
  },
  {
    id: 'DD-12',
    name: 'Cross-Owner Enquiry Read',
    expected: 'PERMISSION_DENIED',
    collection: 'enquiries',
    operation: 'get',
    description: 'Sales Executive cannot read enquiries assigned to and created by another user.'
  }
];
