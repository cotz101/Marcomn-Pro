# Platform Admin Role & Access Control — Verification & Manual Testing Checklist

This checklist is designed to verify the correct database schema setup, backend guard protections, and audit logging features implemented across Stage Admin-1 to Stage Admin-4.

---

## Suggested Testing Order Flow

1. [ ] **Step 1:** Run `platform_admin_roles_migration.sql` in the Supabase SQL Editor.
2. [ ] **Step 2:** Run `assign_first_super_admin.sql` with the correct user UUID in the Supabase SQL Editor.
3. [ ] **Step 3:** Add `SUPABASE_SERVICE_ROLE_KEY` locally (see [Environment Variable Section](#2-server-environment-variable-verification) below).
4. [ ] **Step 4:** Restart the dev server to load the new environment variable.
5. [ ] **Step 5:** Login as the designated super admin.
6. [ ] **Step 6:** Test access to `/admin/mcredits`, `/admin/finance`, and `/settings/global`.
7. [ ] **Step 7:** Perform a wallet grant and a wallet deduct.
8. [ ] **Step 8:** Create two separate top-up requests (required to test both approve and reject workflows).
9. [ ] **Step 9:** Approve the first top-up request.
10. [ ] **Step 10:** Reject the second top-up request.
11. [ ] **Step 11:** Check `platform_admin_audit_logs` table (confirming `mcredits.grant`, `mcredits.deduct`, `topup.approve`, and `topup.reject` keys exist).
12. [ ] **Step 13:** Test blocked access using a normal user account.
13. [ ] **Step 14:** Test granular support, wallet, and finance admin roles using SQL snippets.
14. [ ] **Step 15:** Test legacy `profiles.global_role` fallback.

---

## 1. Supabase Database Setup Verification

Ensure that the migration and bootstrap scripts have run successfully.

- [ ] **Check Table Schema Creation**:
  Verify the new admin tables exist in the database.
- [ ] **Check Seed Roles and Permissions**:
  Verify system roles (`super_admin`, `finance_admin`, etc.) and the 14 permissions are populated.
- [ ] **Verify Super Admin Role Mapping**:
  Verify your targeted user is correctly mapped to the `super_admin` role.

### Verification SQL Queries
Run the following queries in the Supabase Dashboard SQL Editor:

```sql
-- 1. Check tables exist and show row counts
SELECT 
  (SELECT COUNT(*) FROM platform_admin_roles) as roles_count,
  (SELECT COUNT(*) FROM platform_admin_permissions) as permissions_count,
  (SELECT COUNT(*) FROM platform_admin_role_permissions) as role_permissions_count,
  (SELECT COUNT(*) FROM platform_admin_user_roles) as user_assignments_count;

-- 2. Verify all seeded permissions exist
SELECT permission_key, category FROM platform_admin_permissions ORDER BY category, permission_key;

-- 3. Verify user super_admin assignment
SELECT 
  u.id as user_id, 
  u.email, 
  r.role_key, 
  ur.is_active
FROM platform_admin_user_roles ur
JOIN platform_admin_roles r ON ur.role_id = r.id
JOIN auth.users u ON ur.user_id = u.id;
```

---

## 2. Server Environment Variable Verification

Ensure the server bypass key is set correctly and safely.

- [ ] **Verify Environment Variable Configuration**:
  - **Local testing:** Add `SUPABASE_SERVICE_ROLE_KEY` to your `.env.local` file.
  - **Live deployment:** Add `SUPABASE_SERVICE_ROLE_KEY` in Vercel Dashboard → Project → Settings → Environment Variables.
  - **Important:** The key name must be exactly `SUPABASE_SERVICE_ROLE_KEY` and it must **never** be prefixed with `NEXT_PUBLIC_` (which would bundle it in the client code and leak it to the browser).
  - **Important:** Be sure to restart your local development server after editing `.env.local`.
- [ ] **Confirm Client Protection**:
  Inspect browser client bundle network requests or console logs to ensure `SUPABASE_SERVICE_ROLE_KEY` is **never** loaded or exposed to the frontend browser.

---

## 3. Super Admin Execution Verification

Log in as the assigned super admin user.

- [ ] **Dashboard Access**:
  Access the following paths in the browser and verify they load successfully:
  - `/admin/mcredits` (MCredits Platform Ledger)
  - `/admin/finance` (Platform Finance Dashboard)
  - `/settings/global` (Global System Settings)
- [ ] **Test Ledger Grant Action**:
  - Perform a grant action on `/admin/mcredits` with a justification note.
  - *Expected Result:* Balance updates, success toast appears.
- [ ] **Test Ledger Deduct Action**:
  - Perform a deduct action on `/admin/mcredits` with a justification note.
  - *Expected Result:* Balance updates, success toast appears.
- [ ] **Test Top-Up Approve/Reject Queue**:
  - Create **two separate top-up requests** from a company profile.
  - Go to `/admin/mcredits`, locate the first request in the queue, and approve it.
  - Locate the second request in the queue and reject it.
  - *Expected Result:* The approved request credits the wallet. The rejected request is deactivated.
- [ ] **Verify Platform Audit Logging**:
  Verify the actions performed above were successfully logged. Run:
  ```sql
  SELECT 
    actor_user_id,
    action_key,
    target_type,
    target_id,
    details,
    created_at
  FROM platform_admin_audit_logs
  ORDER BY created_at DESC
  LIMIT 5;
  ```
  *Expected Action Keys:*
  - `mcredits.grant`
  - `mcredits.deduct`
  - `topup.approve`
  - `topup.reject`

---

## 4. Normal User Restrictions Verification

Log in as a standard user profile (no admin roles assigned, and `profiles.global_role` set to `'guest_user'` or `'company_member'`).

- [ ] **Frontend Page Guard Verification**:
  Attempt to navigate directly to:
  - `/admin/mcredits`
  - `/admin/finance`
  - `/settings/global`
  - *Expected Result:* Redirected or shows "Access Denied" view with a "Return to Dashboard" action button.
- [ ] **Backend Server Action Protection**:
  Invoke server actions (e.g. via mock script or manual execution of `grantCredits`, `deductCredits`, `approveTopupRequest`, etc.).
  *Expected Result:* Server action blocks execution and throws or returns: `Unauthorized: Missing permission`.

---

## 5. Permission-Specific Roles Verification

Assign a user to one of the granular support, finance, or wallet roles to verify segmentations. Use the `admin_role_testing_snippets.sql` file at the project root to assign and remove these testing roles.

### Case A: Support Admin (`support_admin`)
- [ ] **Access Test**: Navigate to `/admin/mcredits`. Verify that Ledger view is visible but you **cannot** execute Grant or Deduct (buttons should be disabled / read 'Unauthorized').
- [ ] **Top-Up Approve/Reject Test**: Verify that top-up queue approve/reject buttons are disabled and show tooltips.
- [ ] **Server Action Block**: Verify that trying to invoke `grantCredits` server-side throws an error.
- [ ] **Support Interface Expectation:** Note that since the specialized summary-only UI is not yet built, it is fully acceptable for the `support_admin` to view the page containing disabled/restricted controls for now. Clean UI segmentation will be completed in Stage Admin-5/6.

### Case B: Wallet Admin (`wallet_admin`)
- [ ] **Ledger Actions Test**: Verify that Grant and Deduct actions can be successfully completed.
- [ ] **Finance Dashboard Test**: Navigate to `/admin/finance`.
  - *Expected Result:* Access is denied since `wallet_admin` does not have `can_view_finance_reports`.

### Case C: Finance Admin (`finance_admin`)
- [ ] **Finance Dashboard Test**: Navigate to `/admin/finance`. Verify that all summary metrics, revenue reports, and transactions are visible.
- [ ] **Ledger Actions Test**: Navigate to `/admin/mcredits`. Verify that Ledger change forms are disabled.

---

## 6. Legacy Fallback Verification

- [ ] **Verify Legacy Roles**:
  Assign a user a legacy role (e.g. `profiles.global_role = 'admin'` or `'super_admin'`) without any entries in the new `platform_admin_user_roles` table.
- [ ] **Verify Legacy Admin Access**:
  Log in as that user and verify they can still fully access `/admin/mcredits`, `/admin/finance`, and perform operations.
  - *Expected Result:* Fully operational as fallback mapping resolves them to all admin privileges.
