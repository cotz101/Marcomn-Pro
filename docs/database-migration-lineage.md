# Database Migration Lineage

`supabase/migrations/` is MarComn's canonical deployable database-migration lineage. The 30 migrations dated 2026-05-03 through 2026-08-06 were recovered byte-for-byte from Production's authoritative Supabase migration history during DB-1. They are not reconstructed SQL.

The first recorded Production migration alters an already-existing `public.profiles` table. Its pre-tracking bootstrap is not present in Git or Production migration metadata. Therefore the restored lineage is canonical for existing Production history and future deployments, but is **not yet sufficient for an empty-database reset**. Do not invent a prerequisite migration or treat the August snapshot as a deployable substitute; establish and validate a separately approved local bootstrap before claiming fresh-reset reproducibility.

## Archives are not deployable

- `supabase/migration_archive/baseline_20260814_schema_snapshots/` contains the August 2026 schema and Storage snapshots. These are reference/bootstrap artifacts, not Production deployment migrations.
- `supabase/migration_archive/pre_baseline_202608/` contains inactive Group Attachment draft/candidate work. Do not move these files into `supabase/migrations/` without a separately approved release.

A schema snapshot can help inspect or reconstruct a database, but it is not a record that the snapshot SQL may run against an existing database. Migration history records what was actually applied.

## Production release gate

Never use `--include-all` against Production. Never use `migration repair` merely to make history look aligned.

Before a separately authorized Production migration release, run:

```powershell
npx supabase migration list --linked --output-format json
npx supabase db push --linked --dry-run --skip-vault
```

Stop unless the dry-run's pending list is exactly the migrations explicitly approved for that release. A normal deployment uses the same `db push` command without `--dry-run`, only after approval.

`supabase/config.toml` remains local and has migrations disabled for now. A future controlled deployment checkout must enable migrations only after it uses this canonical lineage and passes the dry-run gate.

## Two-phase releases

Normal `db push` applies every pending active migration. A release that requires an application deployment between two database phases must keep the later phase out of the active migration directory until the application phase is deployed and verified.
