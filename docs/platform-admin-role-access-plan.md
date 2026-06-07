# MarComn Platform Admin Role & Access Control Plan

## ⚠️ Current Implementation Warning
**DO NOT IMPLEMENT IMMEDIATELY.**
This document serves as a planning foundation. Implementation should only begin after explicit review and approval of this plan. 

**Critical Rules during Implementation:**
- Do not break Stage 3D refund/penalty logic.
- Do not break Stage 4B-1 engagement lifecycle.
- Do not break Stage 4C-1 top-up flow.
- Do not break Stage 4C-2 finance dashboard.
- Do not break Stage 4C-3 e-receipts.
- Do not break current admin pages (wallet control, global settings, etc.).

---

## 1. Main Structure

The Platform Admin Dashboard will be structured as follows:

```
Platform Admin Dashboard
├── Global Settings
├── MCredits / Wallet Control
├── Finance Dashboard
├── Top-Up Requests
├── Reports / Receipts
├── User Management
├── Company Management
├── Role & Access Management
└── Audit Logs
```

**Important Note:** 
- Global Settings will remain dedicated to platform configurations.
- Role assignments will be strictly managed under **Platform Admin → Role & Access Management**, completely separate from Global Settings.

---

## 2. Proposed Roles

1. **`super_admin`**
   - Full platform control. Unrestricted access to all areas.
2. **`finance_admin`**
   - Can view finance dashboards, reports, receipts, and top-up reports.
3. **`wallet_admin`**
   - Can manage MCredits wallet control, manually grant/deduct credits, and process top-up approvals/rejections.
4. **`support_admin`**
   - Can view user, company, job, and order details to assist with disputes or support cases. Can view basic wallet status and balance summary only if given `can_view_wallet_summary`.
   - **Restrictions:** Should not see full finance reports by default, should not grant/deduct MCredits, should not approve/reject top-ups, and should not view the platform wallet unless explicitly permitted. Sensitive wallet transaction audit trails remain restricted to finance/wallet/super admins only.
5. **`moderator`**
   - Can manage community/content reports. No finance or wallet access by default.

---

## 3. Proposed Permissions

Permissions will be granular to ensure precise access control:

**Dashboard & Settings**
- `can_access_admin_dashboard`
- `can_manage_global_settings`

**Wallet & MCredits**
- `can_view_wallet_control` (full wallet control page access)
- `can_view_wallet_summary` (support-safe read-only view)
- `can_view_personal_wallets`
- `can_view_company_wallets`
- `can_view_platform_wallet`
- `can_grant_mcredits`
- `can_deduct_mcredits`

**Top-Ups**
- `can_view_topup_requests`
- `can_approve_topups`
- `can_reject_topups`

**Finance & Reporting**
- `can_view_finance_dashboard`
- `can_view_finance_reports`
- `can_export_finance_reports`
- `can_view_receipts`
- `can_generate_receipts`
- `can_download_receipts`

**User & Access Management**
- `can_manage_users`
- `can_manage_companies`
- `can_manage_roles`

**Auditing & Disputes**
- `can_view_audit_logs`
- `can_view_dispute_cases`
- `can_manage_dispute_cases`

---

## 4. Database Plan

The following table schema is proposed for role and permission management:

1. **`platform_admin_roles`**
   - `id` (UUID, PK)
   - `role_key` (TEXT, Unique)
   - `role_name` (TEXT)
   - `description` (TEXT)
   - `created_at` (TIMESTAMPTZ)
   - `updated_at` (TIMESTAMPTZ)

2. **`platform_admin_permissions`**
   - `id` (UUID, PK)
   - `permission_key` (TEXT, Unique)
   - `permission_name` (TEXT)
   - `description` (TEXT)
   - `category` (TEXT)
   - `created_at` (TIMESTAMPTZ)
   - `updated_at` (TIMESTAMPTZ)

3. **`platform_admin_role_permissions`**
   - `id` (UUID, PK)
   - `role_id` (UUID, FK -> `platform_admin_roles.id`)
   - `permission_id` (UUID, FK -> `platform_admin_permissions.id`)
   - `created_at` (TIMESTAMPTZ)

4. **`platform_admin_user_roles`**
   - `id` (UUID, PK)
   - `user_id` (UUID, FK -> `auth.users.id`)
   - `role_id` (UUID, FK -> `platform_admin_roles.id`)
   - `assigned_by` (UUID, FK -> `auth.users.id`)
   - `assigned_at` (TIMESTAMPTZ)
   - `status` (TEXT) - Options: `active`, `disabled`, `revoked`

5. **`admin_audit_logs`**
   - `id` (UUID, PK)
   - `actor_user_id` (UUID, FK -> `auth.users.id`)
   - `action_type` (TEXT)
   - `target_type` (TEXT)
   - `target_id` (UUID/TEXT)
   - `details_json` (JSONB)
   - `created_at` (TIMESTAMPTZ)
   - `ip_address` (TEXT, Nullable)
   - `user_agent` (TEXT, Nullable)

---

## 5. Access Rules to Plan

Routes and server actions must strictly enforce these permission checks:

| Route / Action | Required Permission |
| :--- | :--- |
| `/admin/mcredits` | `can_view_wallet_control` |
| `/admin/finance` | `can_view_finance_dashboard` |
| `/settings/global` | `can_manage_global_settings` |
| `/admin/roles` | `can_manage_roles` |
| `/admin/audit` | `can_view_audit_logs` |
| Admin grant MCredits | `can_grant_mcredits` |
| Admin deduct MCredits | `can_deduct_mcredits` |
| Approve top-up | `can_approve_topups` |
| Reject top-up | `can_reject_topups` |
| View platform wallet | `can_view_platform_wallet` |
| Export reports | `can_export_finance_reports` |
| Download receipts | `can_download_receipts` |

---

## 6. Security Requirements

1. **Server-Side Enforcement:** Do not rely on frontend component hiding. Every protected admin page and sensitive server action must verify permissions server-side.
2. **Context Separation:** Platform admin roles are completely separate from company-level roles. Company owners are not automatically platform admins.
3. **Role Assignment Security:** Only a `super_admin` or a user with the `can_manage_roles` permission can assign or revoke admin roles.
4. **Explicit Financial Permissions:** Wallet grants, deductions, and top-up approvals must explicitly require their designated permissions to execute.
5. **Data Privacy:** Finance reports must be strictly hidden from standard users. Global Settings must not be accessible or editable by standard users.
6. **Mandatory Auditing:** Every sensitive administrative action must yield an immutable audit log entry.

---

## 7. Audit Log Plan

To maintain absolute accountability, the system will log the following events:
- Admin approved top-up
- Admin rejected top-up
- Admin granted MCredits
- Admin deducted MCredits
- Admin changed fee settings
- Admin changed global settings
- Admin assigned role
- Admin revoked role
- Admin viewed/exported finance report
- Admin generated/downloaded receipt
- Admin managed dispute/refund case

**Audit details captured per event:**
- Actor user ID
- Action type
- Target type (e.g., `wallet`, `topup_request`, `user_role`)
- Target ID
- Before/After values (if applicable and available)
- Timestamp
- Notes/Reason (admin justification)

---

## 8. Implementation Phasing

**Stage Admin-1: Database Foundation**
- Create role and permission tables (`platform_admin_roles`, `platform_admin_permissions`, etc.).
- Seed the default roles and baseline permissions.
- **Seeding First Super Admin:** Use a one-off database migration or controlled SQL script to assign the first `super_admin` to a specific known user email/user ID. Find the platform owner profile, insert the assignment into `platform_admin_user_roles`, and clearly document this as a one-time bootstrap step.
- Develop a centralized, robust server-side permission-check helper function.

**Stage Admin-2: Protect Current Infrastructure & Transition Fallback**
- Retrofit current admin routes (`/admin/mcredits`, `/admin/finance`, `/settings/global`) and secure existing server actions (top-up approval/rejection, admin grant/deduct) to use the new permission helpers.
- **Legacy Admin Fallback:** During the transition, keep `profiles.global_role` temporarily as a fallback. The new permission helper should check the new role system first, and if no assignment exists, fallback to `profiles.global_role`. This ensures current admin pages remain accessible during the transition. Once fully tested, remove the dependency on `global_role` later.

**Stage Admin-3: Role & Access Management UI**
- Build the interface to list platform admin users.
- Implement UI and logic to assign/revoke roles securely.
- Provide a view to inspect what permissions each role holds.
- Tie role assignment modifications into the audit logging system.

**Stage Admin-4: Audit Logs UI**
- Construct a dedicated dashboard to display administrative audit trails.
- Implement robust filtering by actor, action type, date range, and target.

**Stage Admin-5: Finance & Receipt Permission Refinement**
- Secure any export functionalities (e.g., CSV exports).
- Protect receipt downloads and generation logic.
- Secure all future complex financial reporting routes.

---

## Stage Admin-1 Implementation Notes

- **Migration created**: `platform_admin_roles_migration.sql` (Note: This project currently does not use a `supabase/migrations` directory. The Stage Admin-1 SQL is stored separately at the root as `platform_admin_roles_migration.sql`. It should be manually reviewed and executed in the Supabase Dashboard SQL Editor, and it should not yet be merged into `supabase_migration.sql`. Update: Added `DROP POLICY IF EXISTS` before policy creation to make the script safe to run multiple times.)
- **Super Admin setup helper**: `assign_first_super_admin.sql` (Note: Run this SQL script after `platform_admin_roles_migration.sql` is applied. Be sure to replace the placeholder UUID with the real target user's `auth.users.id` before executing. This is the approved one-time setup method.)
- **Tables added**: `platform_admin_roles`, `platform_admin_permissions`, `platform_admin_role_permissions`, `platform_admin_user_roles`, `platform_admin_audit_logs`.
- **Seeded roles**: `super_admin`, `finance_admin`, `wallet_admin`, `support_admin`, `moderator`.
- **Seeded permissions**: `can_access_platform_admin`, `can_view_wallet_summary`, `can_view_wallet_control`, `can_grant_mcredits`, `can_deduct_mcredits`, `can_approve_topups`, `can_reject_topups`, `can_view_platform_wallet`, `can_view_finance_reports`, `can_manage_global_settings`, `can_manage_admin_roles`, `can_view_admin_audit_logs`, `can_moderate_content`, `can_manage_refund_reviews`.
- **Helper file added**: `lib/adminPermissions.js`.
- **Legacy fallback retained**: Temporarily defaults to checking `profiles.global_role` for backward compatibility.
- **What remains for Stage Admin-2**: Completed in Stage Admin-2. Centralized helpers integrated into route/action guards.

---

## Stage Admin-2 Implementation Notes

- **Centralized Guard Integration**:
  - Integrated `isPlatformAdmin` check from `lib/adminPermissions.js` into server actions (`checkIsAdmin` in `app/actions/adminFinance.js` and `app/actions/mcreditTopups.js`).
  - Added new database roles fetch in client-side profile context (`app/context/ProfileContext.jsx`) to expose `is_platform_admin` to the frontend without breaking RLS rules (relies on self-role query SELECT policy).
- **Client Route Protections Updated**:
  - `app/(protected)/admin/finance/page.jsx`
  - `app/(protected)/admin/mcredits/page.jsx`
  - `app/(protected)/settings/global/page.jsx`
  - `src/components/layout/IdentitySwitcher.jsx` (admin links section)
- **Legacy Fallback Status**: Still fully active via fallback logic inside `lib/adminPermissions.js` (server-side) and `ProfileContext.jsx` (client-side), which maps users containing legacy roles (`super_admin`, `admin`, `brand_manager`) directly to admin capabilities.
- **What remains for Stage Admin-3**: Completed in Stage Admin-3. Secure individual actions with granular permission controls.

---

## Stage Admin-3 Implementation Notes

- **Granular Server-Side Checks Enforced**:
  - `grantCredits` (in `app/actions/mcredits.js`) is now protected with `can_grant_mcredits` permission.
  - `deductCredits` (in `app/actions/mcredits.js`) is now protected with `can_deduct_mcredits` permission.
  - `approveTopupRequest` (in `app/actions/mcreditTopups.js`) is now protected with `can_approve_topups` permission.
  - `rejectTopupRequest` (in `app/actions/mcreditTopups.js`) is now protected with `can_reject_topups` permission.
  - `getPendingTopupRequests` (in `app/actions/mcreditTopups.js`) is now protected with `can_view_wallet_control` permission.
  - Finance reporting functions `getFinanceDashboardSummary`, `getFinanceTransactions`, and `getTopupReport` (in `app/actions/adminFinance.js`) are now protected with `can_view_finance_reports` permission.
- **Client Profile Context Updated**:
  - `app/context/ProfileContext.jsx` now queries all associated permissions (`admin_permissions` array) to make granular checks available client-side.
- **UI Element Visibility Safeguarded**:
  - The Apply change button in `app/(protected)/admin/mcredits/page.jsx` is disabled and labeled 'Unauthorized' if the user lacks grant/deduct permissions.
  - The check-mark (approve) and cross (reject) buttons on the top-up queue items in `/admin/mcredits` are disabled and show helper tooltips if permissions are missing.
- **What remains for Stage Admin-4**: Completed in Stage Admin-4. Platform Admin Audit Logging implemented.

---

## Stage Admin-4 Implementation Notes

- **Audit Helper Created**:
  - `lib/adminAuditLogger.js` was created. Exposes `logPlatformAdminAction(...)` (fails-safe, server-only) and `getRecentAuditLogs(...)`.
- **Supabase Service Client Configuration**:
  - Created a local service role client builder in `lib/adminAuditLogger.js` utilizing `SUPABASE_SERVICE_ROLE_KEY` to bypass secure RLS restrictions on `platform_admin_audit_logs`.
- **Sensitive Actions Monitored**:
  - `grantCredits` (`mcredits.grant`)
  - `deductCredits` (`mcredits.deduct`)
  - `approveTopupRequest` (`topup.approve`)
  - `rejectTopupRequest` (`topup.reject`)
- **Permission Checks**: All checks implemented in Stage Admin-3 remain fully intact and are validated *before* the action and audit logging happen.
- **Legacy Fallback Status**: Still fully active across all queries and permission lookups.
- **What remains for Stage Admin-5**: Build the platform admin interface for viewing audit trails and managing user roles & access controls.

---

## Stage Admin-3 Testing Fixes (Access Control Refinements)

- **Database RPC Updated**: Redefined the PostgreSQL function `get_pending_topup_requests_admin` to allow callers with either the legacy admin role (`super_admin`, `admin`, `brand_manager`) OR the granular `can_view_wallet_control` permission (like `wallet_admin`).
- **MCredits Layout Safeguards**: Adjusted `app/(protected)/admin/mcredits/page.jsx` to hide/show the Platform Fee Configuration, Wallet & Ledger Adjustment, and Pending Top-Up Requests tabs based on the specific permissions (`can_manage_global_settings`, `can_view_wallet_control`, `can_grant_mcredits`, `can_deduct_mcredits`, `can_approve_topups`, `can_reject_topups`). Set dynamic tab fallback redirection on page load.
- **Finance Access Guard Fixed**: Updated the route guard in `app/(protected)/admin/finance/page.jsx` to strictly require `can_view_finance_reports` (or legacy admin fallback) instead of the broad `is_platform_admin`, immediately serving the Access Denied screen for unauthorized platform admin roles (such as `wallet_admin`).
- **Database RLS Policies Fixed**: 
  - Updated RLS policies on `mcredit_topup_requests` and `mcredit_receipts` to allow active platform administrators (`platform_admin_user_roles`) to perform SELECT, INSERT, and UPDATE operations based on their granular permissions (e.g. `can_approve_topups` or `can_reject_topups`), resolving the "Request not found" error during approvals.
  - Updated the database helper function `is_admin_user(user_id)` to recognize users with active platform admin roles in `platform_admin_user_roles`, unlocking standard SELECT/ALL actions on `mcredit_wallets` and `mcredit_transactions`.
  - Updated `platform_settings` policies to grant write access to platform admins with `can_manage_global_settings` permission.
  - *Note: These RLS and database modifications are documented and preserved in the root SQL file [platform_admin_rls_stage3_fix.sql](file:///c:/Users/cotz/.gemini/antigravity/scratch/MarComn/platform_admin_rls_stage3_fix.sql).*
- **Wallet Loading Regression Fix**:
  - Fixed SQL parameter name scope ambiguity in `public.is_admin_user` by renaming the parameter from `user_id` to `p_user_id` (resolving collision with column name `user_id` in table queries).
  - Confirmed the profiles lookup references `profiles.id` since the table schema contains no `user_id` column and uses `id` as the primary key corresponding to auth user IDs.
  - Resolved RLS evaluation infinite recursion errors for normal users by configuring the function to run with `SECURITY DEFINER` and `SET search_path = public`.
  - Restricted the platform role validation inside `is_admin_user` so it checks for specific wallet/finance permissions (`can_view_wallet_control`, `can_grant_mcredits`, `can_deduct_mcredits`, `can_approve_topups`, `can_reject_topups`, `can_view_platform_wallet`, `can_view_finance_reports`) instead of treating any active role as admin.
  - Successfully restored company and personal wallet loading, along with company top-up requests, while preserving admin approvals.
  - Documented and saved the idempotent changes as a new SQL patch [platform_admin_wallet_rls_owner_access_fix.sql](file:///c:/Users/cotz/.gemini/antigravity/scratch/MarComn/platform_admin_wallet_rls_owner_access_fix.sql).
- **Finance Admin Role Alignment**:
  - `finance_admin` role was finalized as reporting-only.
  - Removed top-up approval/rejection permissions (`can_approve_topups`, `can_reject_topups`) from `finance_admin` because top-up approve/reject strictly belongs to `wallet_admin` and `super_admin`.
  - The permission seed mapping in `platform_admin_roles_migration.sql` was cleaned up accordingly.
  - The live DB cleanup is documented and saved as a new SQL patch [platform_admin_finance_role_permission_cleanup.sql](file:///c:/Users/cotz/.gemini/antigravity/scratch/MarComn/platform_admin_finance_role_permission_cleanup.sql).


---

## Stage Admin-5 Implementation Notes

- **Multi-Role Assignment Logic**:
  - The system naturally allows users to hold multiple active roles simultaneously (e.g., `wallet_admin` and `moderator`).
  - Effective permissions are logically combined (union) from all active roles through the existing centralized permission helpers (`userHasAdminPermission` and `getCurrentUserAdminRoles`).
  - Revoking one role does not affect a user's other active roles.
  - The User Role Assignment UI (`/admin/roles`) clearly lists all active assignments as individual rows to ensure granular transparency.
  - An informational UI note was added to remind super administrators that effective permissions are combined from all assigned active roles.
  - Critical safeguards remain: only `super_admin` can assign `super_admin`, and users cannot revoke their own roles to prevent self-lockout.

- **Role Permission Matrix UI (Stage Admin-5B)**:
  - Added a visual role permission matrix UI to `/admin/roles` to view and toggle granular permissions.
  - Groups permissions logically by module (e.g. Wallet, Top-Up, Finance, Settings).
  - Enforces UI and server-side read-only protections for the `super_admin` role.
  - Permission updates are synced atomically within a Postgres transaction using the new `sync_role_permissions` RPC.
  - Logs successful permission updates through `logPlatformAdminAction` under `role.permissions_updated`.
 
 # #   S t a g e   A d m i n - 5 C   I m p l e m e n t a t i o n   N o t e s  
 -   * * A u d i t   L o g   V i e w e r   U I   a d d e d * * :   A   s e c u r e   v i e w e r   a t   / a d m i n / a u d i t - l o g s   f o r   p l a t f o r m _ a d m i n _ a u d i t _ l o g s .  
 -   * * S e r v e r - s i d e   c h e c k * * :   A c c e s s   i s   r e s t r i c t e d   s t r i c t l y   t o   u s e r s   w i t h   c a n _ v i e w _ a d m i n _ a u d i t _ l o g s .  
 -   * * R e a d - o n l y   i n t e r f a c e * * :   L o g s   a r e   d i s p l a y e d   s e c u r e l y   u s i n g   a   S e r v e r   A c t i o n   a n d   s e r v i c e S u p a b a s e   t o   b y p a s s   R L S ,   w i t h o u t   e x p o s i n g   t h e   s e r v i c e   r o l e   k e y   t o   t h e   c l i e n t .  
 -   * * F i l t e r s   s u p p o r t e d * * :   A c t o r   e m a i l ,   A c t i o n   k e y ,   T a r g e t   t y p e ,   D a t e   f r o m ,   D a t e   t o .  
 -   * * D e f a u l t   l i m i t * * :   D i s p l a y s   t h e   1 0 0   m o s t   r e c e n t   l o g s   b y   d e f a u l t   t o   p r o t e c t   d a t a b a s e   p e r f o r m a n c e .  
  
 # #   S t a g e   A d m i n - 6 :   P l a t f o r m   A d m i n   D a s h b o a r d   &   M e n u   T r e e   P o l i s h  
 -   * * P l a t f o r m   A d m i n   D a s h b o a r d   ( / a d m i n ) * * :   A d d e d   a   c e n t r a l   m e n u   t r e e   l a n d i n g   p a g e   f o r   p l a t f o r m   a d m i n i s t r a t o r s .  
 -   * * N a v i g a t i o n   P o l i s h * * :   U n i f i e d   b a c k   l i n k s   a c r o s s   / s e t t i n g s / g l o b a l ,   / a d m i n / m c r e d i t s ,   / a d m i n / f i n a n c e ,   / a d m i n / r o l e s ,   a n d   / a d m i n / a u d i t - l o g s   t o   p o i n t   s a f e l y   t o   / a d m i n .  
 -   * * C u r r e n t   a c t i v e   m o d u l e s * * :   A u t o m a t i c a l l y   u n l o c k e d   a n d   v i s i b l e   b a s e d   o n   p r e c i s e   p e r m i s s i o n s   ( e . g . ,   c a n _ v i e w _ f i n a n c e _ d a s h b o a r d ,   c a n _ m a n a g e _ a d m i n _ r o l e s ) .  
 -   * * F u t u r e   m o d u l e s * * :   ' C o m i n g   S o o n '   p l a c e h o l d e r   c a r d s   c l e a r l y   d i s p l a y   f u t u r e   r o a d m a p   a r e a s   l i k e   M o d e r a t i o n ,   D i s p u t e   R e v i e w ,   B r a n d i n g ,   a n d   N o t i f i c a t i o n s .  
 -   * * B u s i n e s s   L o g i c   S c o p e * * :   T h i s   s t a g e   f o c u s e s   p u r e l y   o n   U I   s t r u c t u r e   a n d   n a v i g a t i o n   g r o u p i n g .   I t   d o e s   n o t   i n t r o d u c e   o r   a l t e r   u n d e r l y i n g   b a c k e n d   l o g i c ,   R L S   r u l e s ,   o r   e x i s t i n g   s t r i c t   p e r m i s s i o n   e n f o r c e m e n t   f u n c t i o n s .  
 -   / a d m i n   l a n d i n g   d a s h b o a r d   a l l o w s   a n y   p l a t f o r m   a d m i n   w i t h   a t   l e a s t   o n e   m a p p e d   a d m i n   p e r m i s s i o n .  
 -   S e c t i o n   c a r d s   a r e   p e r m i s s i o n - a w a r e .  
 -   D i r e c t   p a g e   p r o t e c t i o n s   r e m a i n   u n c h a n g e d .  
 