# Future Backlog Plan — MarComn Platform Admin Role & Access Control

## Purpose

MarComn currently has admin-related areas such as MCredits / Wallet Control, Global Settings, top-up approvals, and future Finance Dashboard features. These areas should not remain hardcoded to one user or loosely controlled.

A future stage should introduce a proper **Platform Admin Role & Access Control** system so the platform owner can assign who can access and manage specific admin modules.

This is a future backlog item only. Do not implement until explicitly instructed.

---

## Main Concept

Create a centralized:

```text
Platform Admin Dashboard
```

with module-based access control.

Suggested admin structure:

```text
Platform Admin Dashboard
├── Global Settings
├── MCredits / Wallet Control
├── Top-Up Requests
├── Finance Dashboard
├── Reports / Receipts
├── User Management
├── Company Management
├── Role & Access Management
└── Audit Logs
```

Global Settings should remain for platform configuration, while role assignment should be handled in a separate **Role & Access Management** area.

---

## Why This Is Needed

The platform will eventually need different levels of admin access.

Examples:

* One person may manage MCredits only.
* One person may approve top-ups only.
* One person may view finance reports but not grant/deduct credits.
* One person may manage global settings.
* One super admin may control everything.
* Support staff may view cases but not change wallet balances.

This avoids giving full platform control to every admin user.

---

## Proposed Admin Roles

Suggested role names:

```text
super_admin
finance_admin
wallet_admin
support_admin
moderator
```

### super_admin

Full platform control.

Can access:

```text
Global Settings
MCredits / Wallet Control
Top-Up Requests
Finance Dashboard
Reports
User / Company Management
Role & Access Management
Audit Logs
```

### finance_admin

Finance-focused access.

Can access:

```text
Finance Dashboard
Top-Up Reports
Transaction Reports
Platform Revenue Reports
Receipts / E-receipts
```

May or may not be allowed to approve top-ups depending on permissions.

### wallet_admin

MCredits operational access.

Can access:

```text
MCredits / Wallet Control
Top-Up Requests
Wallet Transactions
Admin Grant / Deduct
```

### support_admin

Support and review access.

Can access:

```text
User / Company lookup
Application / engagement records
Refund/dispute review cases
Limited wallet visibility
```

Should not be able to grant/deduct credits unless permission is explicitly given.

### moderator

Community/content-focused access.

Can access:

```text
Reports
Flagged content
Groups/posts/blog moderation
```

No finance access by default.

---

## Granular Permissions

Instead of relying only on role names, add permission keys.

Suggested permission keys:

```text
can_access_admin_dashboard
can_manage_global_settings

can_view_wallet_control
can_view_personal_wallets
can_view_company_wallets
can_view_platform_wallet

can_grant_mcredits
can_deduct_mcredits

can_view_topup_requests
can_approve_topups
can_reject_topups

can_view_finance_dashboard
can_view_finance_reports
can_export_finance_reports

can_view_receipts
can_generate_receipts
can_download_receipts

can_manage_users
can_manage_companies
can_manage_roles

can_view_audit_logs
can_view_dispute_cases
can_manage_dispute_cases
```

---

## Database Planning

Possible tables:

### platform_admin_roles

Stores role definitions.

Suggested columns:

```text
id
role_key
role_name
description
created_at
updated_at
```

Example role keys:

```text
super_admin
finance_admin
wallet_admin
support_admin
moderator
```

### platform_admin_permissions

Stores available permission keys.

Suggested columns:

```text
id
permission_key
permission_name
description
category
created_at
updated_at
```

### platform_admin_role_permissions

Maps roles to permissions.

Suggested columns:

```text
id
role_id
permission_id
created_at
```

### platform_admin_user_roles

Assigns roles to users.

Suggested columns:

```text
id
user_id
role_id
assigned_by
assigned_at
status
```

Status options:

```text
active
disabled
revoked
```

### admin_audit_logs

Tracks sensitive admin actions.

Suggested columns:

```text
id
actor_user_id
action_type
target_type
target_id
details_json
created_at
ip_address nullable
user_agent nullable
```

---

## Admin UI Requirements

Create a future section:

```text
Platform Admin → Role & Access Management
```

Features:

1. View admin users.
2. Assign role to user.
3. Remove/revoke role from user.
4. View permissions per role.
5. Show clear warning for sensitive permissions.
6. Only super_admin can manage roles.
7. Audit all role assignment changes.

Suggested UI:

```text
Admin User
Role
Permissions Summary
Status
Assigned By
Assigned At
Actions
```

---

## Route Protection Requirements

Admin pages should not rely on frontend hiding only.

Every protected admin route must check permission server-side.

Pages to protect:

```text
/admin/mcredits
/settings/global
/admin/finance
/admin/topups
/admin/roles
/admin/audit
```

Example access rules:

```text
/admin/mcredits
requires can_view_wallet_control

admin grant/deduct
requires can_grant_mcredits or can_deduct_mcredits

top-up approval
requires can_approve_topups

top-up rejection
requires can_reject_topups

global settings
requires can_manage_global_settings

finance dashboard
requires can_view_finance_dashboard

role management
requires can_manage_roles
```

---

## MCredits / Wallet Control Permission Rules

MCredits actions should be protected carefully.

### View Wallet Control

Requires:

```text
can_view_wallet_control
```

### Grant MCredits

Requires:

```text
can_grant_mcredits
```

### Deduct MCredits

Requires:

```text
can_deduct_mcredits
```

### Approve Top-Up

Requires:

```text
can_approve_topups
```

### Reject Top-Up

Requires:

```text
can_reject_topups
```

### View Platform Wallet

Requires:

```text
can_view_platform_wallet
```

---

## Finance Dashboard Permission Rules

Future Finance Dashboard should be protected by:

```text
can_view_finance_dashboard
```

Reports should use:

```text
can_view_finance_reports
```

Export should use:

```text
can_export_finance_reports
```

Receipts/e-receipts should use:

```text
can_view_receipts
can_generate_receipts
can_download_receipts
```

---

## Global Settings Role

Global Settings should remain a configuration section, not the main role assignment area.

Global Settings may include:

```text
MCredit fee percentages
Offer expiry settings
Top-up mode settings
Auto-close job settings
Theme/logo settings
Theme/logo settings
Notification settings
```

But assigning admin users and roles should be handled in:

```text
Platform Admin → Role & Access Management
```

---

## Audit Requirements

Every sensitive admin action should be logged.

Examples:

```text
Admin approved top-up
Admin rejected top-up
Admin granted MCredits
Admin deducted MCredits
Admin changed MCredit fee setting
Admin assigned role
Admin revoked role
Admin viewed/exported finance report
Admin generated receipt
```

Audit log should include:

```text
who performed the action
what action was performed
which record was affected
before/after values if available
timestamp
notes/reason
```

---

## Security Requirements

1. Do not hardcode admin access by user ID long-term.
2. Do not rely only on frontend hiding.
3. Every admin server action must check permissions.
4. Every sensitive admin action must create an audit log.
5. Role assignment must be limited to super_admin.
6. Wallet grant/deduct/top-up approval must require explicit permission.
7. Finance reports must not be visible to normal users.
8. Global Settings must not be editable by normal users.
9. Company admins are not the same as platform admins.
10. Company owners should not access platform admin tools unless separately assigned a platform admin role.

---

## Suggested Implementation Stages

### Future Stage Admin-1 — Role & Permission Database Foundation

* Create admin role/permission tables.
* Seed default roles and permissions.
* Assign first super_admin manually.
* Add helper function to check permissions.

### Future Stage Admin-2 — Protect Admin Routes and Server Actions

* Protect `/admin/mcredits`.
* Protect `/settings/global`.
* Protect top-up approval/rejection.
* Protect admin grant/deduct.
* Add server-side permission checks.

### Future Stage Admin-3 — Role & Access Management UI

* Add admin page for managing platform admin users.
* Assign/revoke roles.
* View role permissions.
* Log role changes.

### Future Stage Admin-4 — Admin Audit Logs

* Add audit log table and UI.
* Track wallet control actions.
* Track top-up actions.
* Track global settings changes.
* Track role management changes.

### Future Stage Admin-5 — Finance Dashboard Permissions

* Protect finance reports.
* Add report export permission.
* Add receipt/e-receipt permissions.

---

## Do Not Implement Yet

This plan is for future implementation only.

Do not modify current working wallet logic yet.

Do not break:

```text
Stage 3D refund/penalty logic
Stage 4B-1 engagement lifecycle
Stage 4C-1 top-up flow
Global settings
Notification system
Job posting flow
```

This should be implemented only after the current wallet/top-up system and admin finance dashboard foundation are stable.
