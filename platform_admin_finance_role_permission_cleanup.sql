-- SQL Patch: Platform Admin Finance Role Permission Cleanup
-- This patch aligns the finance_admin role with a finance-reporting focus by removing
-- top-up approval and rejection permissions.

DELETE FROM platform_admin_role_permissions
WHERE role_id = (SELECT id FROM platform_admin_roles WHERE role_key = 'finance_admin')
  AND permission_id IN (
    SELECT id FROM platform_admin_permissions
    WHERE permission_key IN ('can_approve_topups', 'can_reject_topups')
  );

-- Verification comment explaining correct permission mappings:
-- finance_admin keeps: can_access_platform_admin, can_view_wallet_summary, can_view_platform_wallet, can_view_finance_reports, can_view_admin_audit_logs
-- finance_admin does NOT have: can_approve_topups, can_reject_topups
