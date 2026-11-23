# Security Specification — Azure Travel CRM

## 1. Data Invariants
1. **Authenticated & Verified Access Only**: Every read and write requires `request.auth != null && request.auth.token.email_verified == true`. Unauthenticated users have zero access to any collection.
2. **Default-Deny Safety Net**: `match /{document=**} { allow read, write: if false; }` is declared first.
3. **Zero Privilege Escalation**: Non-admin employees can never modify their own `role`, `status`, or `permissions` in `/employees/{uid}`. Only a verified `Super Admin` or `Admin` (or the bootstrapped Super Admin email) can create/update employee roles or invites.
4. **Invited Activation Integrity**: A non-bootstrapped user may only create their `/employees/{uid}` profile if a matching `/employee_invites/{email}` document exists and the incoming `role` and `permissions` match the invite.
5. **PII & Record Scoping**:
   - Sales Executives and Customer Support can only list/read `enquiries`, `quotations`, `customers`, and `followups` assigned to them or created by them unless elevated to Manager/Admin.
   - `employees` PII (email, phone) is restricted to the owner (`uid == request.auth.uid`) or active CRM staff (`isActiveEmployee()`).
6. **Master Gate on Subcollections**: `/enquiries/{enquiryId}/activities/{activityId}` enforces `exists()`/`get()` on the parent enquiry and verifies the actor is an authorized active employee or assigned owner.
7. **Strict Schema & Bounds Validation**: Every `create` and `update` invokes `isValid[Entity](incoming())`, validating `keys().hasAll(...)`, `keys().hasOnly(...)`, string `.size()` limits, enum allowlists, and `request.time` server timestamps.
8. **Immutable Ownership & Terminal Locks**: `createdByUid` and `createdAt` cannot be modified after creation. Cancelled bookings and completed payments cannot be arbitrarily overwritten by non-admins.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read**: `getDocs(collection(db, 'enquiries'))` with `auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: Signed-in user with `email: 'barnabassherpa@gmail.com'` and `email_verified: false` attempting `setDoc('/employees/spoof', { role: 'Super Admin' })` -> `PERMISSION_DENIED`.
3. **Self-Role Escalation (Create)**: Non-invited user creating `/employees/{uid}` with `role: 'Super Admin'` -> `PERMISSION_DENIED`.
4. **Self-Role Escalation (Update)**: Sales Executive updating `/employees/{uid}` changing `role` from `'Sales Executive'` to `'Admin'` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection**: Creating an enquiry with all required fields plus `ghostAdminFlag: true` -> `PERMISSION_DENIED` (`hasOnly` rejection).
6. **ID Poisoning (Oversized Path ID)**: Writing `/enquiries/${'x'.repeat(200)}` -> `PERMISSION_DENIED` (`isValidId` length <= 128).
7. **ID Character Injection**: Writing `/enquiries/bad$id!with*chars` -> `PERMISSION_DENIED` (`isValidId` regex).
8. **Payload Exhaustion (1MB String)**: Creating an enquiry with `specialRequirements: 'a'.repeat(5000)` -> `PERMISSION_DENIED` (`.size() <= 2000`).
9. **Identity Spoofing on Create**: User `uidA` creating an enquiry with `createdByUid: 'uidB'` -> `PERMISSION_DENIED` (`incoming().createdByUid == request.auth.uid`).
10. **Immutable Field Tampering**: Updating an enquiry while altering `createdAt` or `createdByUid` -> `PERMISSION_DENIED`.
11. **Timestamp Forgery**: Creating a booking with client-supplied past `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
12. **Cross-Owner Enquiry Read**: Sales Executive `uidA` reading an enquiry assigned to and created by `uidB` -> `PERMISSION_DENIED`.
