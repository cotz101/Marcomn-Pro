# Phase 1.3B Group Attachment Production Migration Runbook

Status: planning draft. Preparing this runbook applied nothing.

PR: `#10` (draft)

Approved branch: `codex/group-attachments-phase-1-3b-foundation`

Approved commit: `912c1af30d4c523ef8d3d49706ba10231eac11ec`

## Scope and exclusions

This runbook governs a future, separately authorized production execution of the six Phase 1.3B
database migrations. It covers preflight, backups, ordered execution, read-only verification,
rollback decisions and existing-messaging smoke tests.

It does **not** authorize a migration, Supabase login/link, Storage object mutation, test-data write,
cleanup scheduler, physical deletion, application deployment, attachment UI, PR merge or production
smoke test. Phase 1.3B adds foundation only. Signed-client Realtime validation and attachment sending
remain Phase 1.3C work.

Never put a database password, access token, service-role key or backup encryption key in a command
line, connection URL, shell history, environment variable, log, ticket, PR or this document. Use the
approved interactive secret-delivery mechanism below. Do not record an authentication session.

## Approved artifacts and hashes

The current feature commit is the reviewed source commit. It is not a production execution source.
After PR #10 is approved and merged, the fast-forwarded merged-main commit becomes the production
execution source. Verify these same hashes from merged main; any difference after merge is NO-GO.

| Order | File | SHA-256 |
|---:|---|---|
| 1 | `20260813043220_group_message_attachment_foundation.sql` | `905770630E769CEFB42187F019A40A62139429BD864FBC81DB0F81F0C0DD9D85` |
| 2 | `20260813043230_group_message_attachment_authorization.sql` | `DD9366AD0388D02446B0CF8DBA7BA0B9DAE281E789D1004F10BA2B0ECD123A52` |
| 3 | `20260813043239_group_message_attachment_storage.sql` | `26CA7CCB30663BCE4AEED85CE69732E93196E084152733B8F14F082AD49F190F` |
| 4 | `20260813043246_group_message_transactional_send.sql` | `A0ECD7E0B999EAB2C8769670BBEC0C32E10F4A33135D23B2B917BE5AAC647054` |
| 5 | `20260813043253_group_message_moderation.sql` | `BDFBB957321D2B763888DA19555D807FDE4BB91158D889D12D839AB1E56883A6` |
| 6 | `20260813043307_group_message_cleanup_outbox.sql` | `8200E49E9784DE64DA6182002DB7D6A2017F3DB836898F7898CF0C10A46EDDA8` |

Any mismatch is an immediate stop. Do not normalize line endings or edit comments after hashing.

## Read-only production drift check — 2026-08-13

Result: **PASS; no relevant drift detected** using catalog-only `SELECT` queries.

- PostgreSQL remains 17.6.
- `group_thread_messages` retains the audited ten columns, including UUID
  `reply_to_message_id` and text `reply_author_name`/`reply_preview`.
- RLS is enabled, FORCE RLS is disabled, and owner is `postgres`.
- The permissive authenticated message SELECT and INSERT policies are unchanged.
- The broad starting `anon`/`authenticated` table grants remain and Migration 5 must tighten them.
- Membership status constraint remains `pending/member/banned`; role remains
  `member/moderator/admin`.
- `group_comments.post_id` still references `group_posts.id ON DELETE CASCADE`.
- Nine threads remain: seven have a same-ID post and two do not. The latter follow reconciliation.
- `group_thread_messages` remains in `supabase_realtime` without a publication row filter.
- `group-message-attachments` remains unused.
- All proposed schemas, types, tables, functions, triggers, policies and indexes remain unused.

Repeat the queries in **Pre-execution drift queries** immediately before the window. Any difference in
these facts is material drift: declare **NO-GO**, preserve output and return to engineering review.

## Execution mechanism decision

Repository inspection found no GitHub Actions migration workflow, no migration command in
`package.json`, no `vercel.json` migration hook and no other migration service configuration. Vercel
currently runs the application build (`next build`) and does **not** run database migrations. Older
repository documents describe manual Dashboard SQL Editor execution.

### Secret-safe CLI decision

Local inspection reconfirmed that the pinned CLI is exactly 2.114.0. Its
`npx supabase db push --help` exposes `--db-url string`, `--project-ref string`, and
`--password/-p string`; it does not expose a password-file or file-descriptor option. A populated
`--db-url` necessarily places the database password in the process command line, and a populated
`--password` does the same. Both are prohibited. The previous `--db-url` recommendation is therefore
withdrawn.

Supabase's official CLI documentation states that remote database commands prompt for the database
password when it is not supplied and identifies `SUPABASE_DB_PASSWORD` as the non-interactive
alternative. For this production procedure, the environment-variable alternative is also prohibited:
it leaves plaintext in the operator process environment and can be inherited by child processes or
captured by diagnostics. See [Supabase CLI reference](https://supabase.com/docs/reference/cli/supabase-db-push)
and [CLI authentication troubleshooting](https://supabase.com/docs/guides/troubleshooting/supabase-cli-failed-sasl-auth-or-invalid-scram-server-final-message).

The only acceptable CLI 2.114.0 candidate is therefore:

- a hardened, access-controlled operator workstation with no shell/session recording, debug tracing,
  crash capture, screen sharing, screenshots or unapproved observers;
- a separately authorized Supabase login completed interactively, with its access token held by the
  CLI's native credential storage rather than passed on the command line or exported to the shell;
- explicit targeting by the non-secret project reference via `--project-ref` (never `--db-url` and
  never `--linked`);
- omission of `--password/-p` and `SUPABASE_DB_PASSWORD`, followed by entry of the database password
  only into the CLI's masked interactive prompt; and
- immediate closure of the authenticated operator session after verification, following the
  organization's credential/session revocation procedure.

The database password is supplied only as keystrokes to the masked CLI prompt. The operator must
verify before entry that the prompt is emitted by the pinned local `npx supabase` binary. Because the
password is never part of a command, URL, environment assignment, clipboard paste, transcript or
document, it does not appear in shell history or ordinary process command-line listings. Session
recording, PowerShell transcription, terminal scrollback capture, CLI `--debug`, diagnostic dumps,
screen recording, screen sharing and screenshots must be disabled or excluded from the password-entry
interval. Logs may begin only after the prompt has completed and must be redacted and reviewed before
retention. The operator must not paste the secret and must clear any clipboard that was used by the
approved secret-delivery system before opening the terminal.

This candidate is **not yet production-approved**. Before the window, rehearse the exact pinned command
against an isolated disposable Supabase project with a synthetic password and demonstrate that it:
(1) targets the supplied project reference without creating a link, (2) presents a masked password
prompt, (3) keeps the password absent from shell history, standard process listings and captured
redacted output, and (4) records migration history correctly. The rehearsal must inspect only the
synthetic secret and must not attempt to prove absence by exposing the real production password.

If any condition fails—or if CLI 2.114.0 requires the password in `--db-url`, `--password`, an
environment variable, a link file, or another recordable location—the CLI is **NO-GO**. Do not relax
the secret rule and do not use it for production. Escalate to the fallback Dashboard SQL Editor plan,
which requires a separately approved operator packet, transaction/order controls and explicit
migration-history reconciliation.

Only after the rehearsal and a separate production authorization, run the dry run with the
independently verified, non-secret project reference:

```text
npx supabase db push --project-ref "<INDEPENDENTLY_VERIFIED_PRODUCTION_PROJECT_REF>" --skip-vault --dry-run
```

Do not add `--password`, set `SUPABASE_DB_PASSWORD`, or embed credentials in any URL. The dry run must
list exactly the six files above, once, in order. The later execution command is the same without
`--dry-run` and must again use masked interactive password entry. Commands shown here are procedure
templates, not actions performed while preparing this document. If migration-history reconciliation
is needed, stop; do not use migration repair during the window without a separately reviewed plan.

Dashboard SQL Editor is fallback-only. It loses the preferred CLI history workflow and increases
copy/order risk; if required, it needs a separate signed execution packet and explicit history plan.

### Disposable migration-history rehearsal — 2026-08-13

Result: **PASS for local migration-history behavior; BLOCKED for hosted `--project-ref` secret
interaction**.

The rehearsal used CLI 2.114.0, the disposable local PostgreSQL container at
`127.0.0.1:54322`, synthetic local credentials and the minimum synthetic legacy Group schema. The
pre-existing sanitized `supabase_migrations.schema_migrations` snapshot had the audited table shape
(`version text` primary key, `statements text[]`, `name text`) and contained zero Phase 1.3B versions.
No production reference, URL, password, identity or data was used.

Sanitized evidence:

- initial `migration list` against the explicit localhost database URL showed exactly
  `20260813043220`, `20260813043230`, `20260813043239`, `20260813043246`,
  `20260813043253`, and `20260813043307` as local-only, in that order;
- `migration up` applied exactly the six canonical files in that order;
- history then contained exactly six new rows with those versions and canonical names;
- a second `migration list` showed every local version matched by the same database version, which
  means zero pending migrations;
- neither `migration repair` nor `--include-all` was used or required; and
- all six SHA-256 values remained identical to the approved hashes above.

This proves local history selection, ordering, recording and idempotent re-preview. It does **not**
prove the proposed hosted authentication path. `--project-ref` identifies a Supabase-hosted project
through the platform API and cannot target a fully disposable local project. Proving its masked
interactive password behavior inherently requires CLI authentication and a real hosted project.
Therefore the CLI production mechanism remains **BLOCKED** pending a separately controlled rehearsal
against a non-production Supabase cloud project. Do not simulate or infer that result from localhost.

## Pre-deployment backup checklist

All items are mandatory before GO:

- [ ] Confirm Supabase Point-in-Time Recovery availability, enabled status, earliest restore point and
  a restore target immediately before execution in the Dashboard. Catalog access cannot prove PITR.
- [ ] If PITR is unavailable, obtain explicit risk acceptance **and** a fresh provider-supported
  database backup before continuing; otherwise NO-GO.
- [ ] Create an encrypted logical backup and a schema-only backup immediately before the window.
- [ ] Export catalog definitions for relevant tables, constraints, indexes, RLS/FORCE RLS flags,
  policies, grants, triggers, functions, owners and `search_path` settings.
- [ ] Export the existing Supabase migration-history rows and their checksums/names.
- [ ] Take a metadata-only inventory of relevant Storage buckets and objects: bucket configuration,
  object counts, names/paths, MIME, size and timestamps. Do not download object bodies.
- [ ] Record the preflight query output, approved commit and all seven content hashes.
- [ ] Encrypt backup artifacts, restrict access and record restore instructions.
- [ ] Record the exact restore procedure, named restore operator, isolated restore destination,
  expected restoration duration and post-restore validation method.
- [ ] Record signed evidence that the restore operator reviewed the procedure and can access the
  required controls. Merely proving that backup files are readable is insufficient; the procedure,
  destination, timing and validation must be operationally credible.
- [ ] Do not test restoration into production during this preparation. Any restore rehearsal must use
  a separately authorized isolated destination.
- [ ] Retain artifacts for at least 30 days and until Phase 1.3C has passed production verification,
  whichever is later. Extend for organizational/legal policy.
- [ ] Have an independent verifier confirm that each artifact is readable and timestamped before GO.

## Maintenance and risk controls

Recommended window: lowest observed Group messaging traffic, with 60 minutes reserved and 30 minutes
of post-check observation. Maximum migration execution time is **10 minutes total** and **3 minutes for
any single transaction**. Exceeding either is an immediate stop after allowing the active transaction
to finish or roll back; never kill it without the database operator's decision.

Expected impact: `ALTER TABLE`, policy/grant changes, trigger creation and index creation can acquire
locks and briefly block Group message reads/writes. Migration 1 is the primary lock risk. New tables
are lower risk. Migration 5 changes browser privileges immediately at commit.

Disable **Group thread message sending only** during execution and core verification if the application
has an already-reviewed reversible feature switch. Keep reading available when healthy. If no switch
exists, announce a short messaging maintenance window; do not improvise application changes. Direct
and Application messaging outside Group threads should remain enabled and monitored.

Required decisions; do not invent names:

| Responsibility | Required assignee |
|---|---|
| GO/NO-GO owner | `[PRODUCT/INCIDENT OWNER — REQUIRED]` |
| Production Supabase operator | `[DB OPERATOR — REQUIRED]` |
| Independent SQL/output verifier | `[SECURITY/DB REVIEWER — REQUIRED]` |
| Application smoke-test lead | `[QA OWNER — REQUIRED]` |
| Communications lead | `[COMMUNICATIONS OWNER — REQUIRED]` |
| Rollback decision owner | `[INCIDENT COMMANDER — REQUIRED]` |

Stop conditions:

- hash, branch, commit, dry-run order or target mismatch;
- any drift from the approved catalog baseline;
- PITR/backup/restore evidence missing;
- unexpected migration in dry run or migration-history ambiguity;
- lock wait over 60 seconds, any transaction over 3 minutes, or total execution over 10 minutes;
- SQL error, unexpected object owner/grant/policy, elevated error rate or messaging regression;
- private bucket conflict, unexpected object in the proposed bucket, or Storage policy conflict;
- inability of the independent verifier to reproduce results;
- Vercel install/build commands differ from the reviewed behavior or begin invoking Supabase, SQL,
  schema, migration or deployment commands; or
- the separately controlled non-production hosted Supabase rehearsal is incomplete, differs from the
  approved CLI 2.114.0 workflow, or requires any credential in flags, a URL, an environment variable,
  shell history, normal process listings, retained output or another prohibited location.

## Go/no-go checklist

- [ ] Final runbook approval is recorded.
- [ ] PR #10 was marked ready, approved and merged to `main`.
- [ ] Local `main` was synchronized by fast-forward only; merged-main SHA is recorded.
- [ ] All six hashes match when computed from merged main. Any difference is NO-GO.
- [ ] Vercel production build for merged main succeeded.
- [ ] Vercel install/build settings and logs were rechecked and contain no Supabase or migration
  command. Any changed behavior is NO-GO.
- [ ] All hashes match and repository worktree is clean.
- [ ] Fresh drift check is PASS.
- [ ] PITR/backup checklist is complete.
- [ ] Non-secret production project reference and operator authorization are independently verified.
- [ ] A separately controlled non-production hosted Supabase rehearsal using CLI 2.114.0 passed and
  proves: explicit `--project-ref`; no linked project or `--linked`; a masked interactive password
  prompt; no credential in flags, URL, environment, shell history, normal process listings or retained
  output; exactly six canonical migrations selected in order; exactly six migration-history entries
  recorded; and a second dry run reporting zero pending migrations.
- [ ] Shell/session recording, debug tracing, diagnostics and screen capture are disabled for secret
  entry; no password is present in flags, URLs, environment variables or clipboard.
- [ ] CLI is exactly 2.114.0; dry run lists exactly six migrations in order.
- [ ] Maintenance notice sent; Group sends disabled or maintenance impact accepted.
- [ ] Dashboard, database metrics, API errors and lock monitoring are open.
- [ ] Rollback/application rollback artifacts are ready.
- [ ] Every responsibility and approval placeholder is filled.
- [ ] GO recorded by both GO/NO-GO owner and database operator.

## Pre-execution drift queries

Run only read-only catalog queries. Save outputs without row content or identities.

```sql
select current_setting('server_version') as server_version;

select ordinal_position,column_name,data_type,udt_name,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name='group_thread_messages'
order by ordinal_position;

select relrowsecurity,relforcerowsecurity,pg_get_userbyid(relowner) owner
from pg_class where oid='public.group_thread_messages'::regclass;

select policyname,permissive,roles,cmd,qual,with_check
from pg_policies
where (schemaname='public' and tablename='group_thread_messages')
   or (schemaname='storage' and tablename='objects')
order by schemaname,tablename,policyname;

select grantee,privilege_type,is_grantable
from information_schema.table_privileges
where table_schema='public' and table_name='group_thread_messages'
  and grantee in ('anon','authenticated','service_role')
order by grantee,privilege_type;

select conname,pg_get_constraintdef(oid,true)
from pg_constraint
where conrelid in ('public.group_members'::regclass,'public.group_comments'::regclass)
order by conrelid::regclass::text,conname;

select count(*) thread_count,
       count(p.id) same_id_post_count,
       count(*)-count(p.id) missing_same_id_post_count
from public.group_threads t left join public.group_posts p on p.id=t.id;

select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets where id='group-message-attachments';

select pubname,schemaname,tablename,rowfilter
from pg_publication_tables
where schemaname='public' and tablename='group_thread_messages';
```

Also repeat the approved name-collision query from the live-schema audit. Every proposed-name count
must be zero and the bucket query must return no row.

## Exact ordered execution procedure

The mandatory release sequence is:

1. Obtain final runbook approval.
2. Mark PR #10 ready for review.
3. Obtain approval and merge PR #10 to `main`.
4. Synchronize local `main` by fast-forward only.
5. Record the merged-main commit SHA.
6. Verify all six migration hashes from merged main; any difference is NO-GO.
7. Verify the Vercel production build from merged main completed successfully.
8. Reconfirm Vercel build logs contain no Supabase or migration command; changed install/build
   behavior is NO-GO.
9. Obtain a separately authorized production database window.
10. During that window, run the fresh drift check, verify backup/PITR evidence, perform the approved
    dry run, obtain GO approval and only then execute.

Merging PR #10 neither authorizes nor executes SQL. Production SQL must never be executed from the
feature branch. The reviewed feature SHA remains provenance; the recorded merged-main SHA is the only
future production source.

Within the separately authorized database window:

1. Open monitoring and pause Group sends as approved.
2. Verify merged main, CLI version, SHA-256 values and clean worktree.
3. Verify backups/PITR and capture migration history.
4. Run the fresh read-only drift checks; obtain two-person GO.
5. Run the CLI dry-run with explicit non-secret `--project-ref --skip-vault`, no password flag or
   password environment variable, and masked interactive password entry; save only reviewed redacted
   output produced after authentication.
6. Confirm exactly migrations 1–6 below. If not, stop.
7. Run the separately authorized CLI push with the same explicit project reference, secret controls
   and `--skip-vault`.
8. Observe each migration transaction and record start/end/result. Do not reorder or retry blindly.
9. On error, stop. Follow the rollback decision tree; do not proceed to later files.
10. Run post-migration catalog verification and existing-messaging smoke tests.
11. Restore Group sending only after the independent verifier signs off.
12. Observe metrics for 30 minutes and close or escalate the window.

## Migration-by-migration control sheet

### 1 — `20260813043220_group_message_attachment_foundation.sql`

Purpose: delivery lifecycle, attachment enums/table, constraints, indexes and integrity triggers.

Preconditions: exact legacy message/reply columns; no proposed names; RLS baseline confirmed; no long
message-table transaction. Expected transaction: one explicit `BEGIN/COMMIT`; any SQL error rolls back
the entire migration. Expected changes: two message columns, lifecycle/content constraints, two message
indexes, two enums, attachment table/indexes, three trigger functions and three triggers.

Verify:

```sql
select column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name='group_thread_messages'
  and column_name in ('delivery_status','reservation_request');
select conname,pg_get_constraintdef(oid,true)
from pg_constraint where conrelid in
 ('public.group_thread_messages'::regclass,'public.group_message_attachments'::regclass)
order by conname;
```

Failure symptoms: lock timeout, duplicate name, incompatible existing data or constraint error. Safe
action: let automatic transaction rollback complete, verify no Migration 1 objects remain, keep sends
paused and investigate. Do not hand-apply fragments.

### 2 — `20260813043230_group_message_attachment_authorization.sql`

Purpose: dedicated private helper schema, authorization helpers and six-layer message/attachment RLS
composition (three policies in this migration plus existing permissive policies).

Preconditions: Migration 1 committed; membership constraints unchanged; existing permissive message
SELECT/INSERT policies present. Expected: private schema, three definer helpers, attachment SELECT,
restrictive authenticated/anonymous SELECT guards and restrictive legacy INSERT guard. Explicit
transaction automatically rolls back on failure.

Verify:

```sql
select policyname,permissive,roles,cmd
from pg_policies
where schemaname='public' and tablename in ('group_thread_messages','group_message_attachments')
order by tablename,policyname;
```

Failure symptoms: schema/name collision, missing dependency or policy syntax/role error. Safe action:
stop; automatic rollback of Migration 2. Do not continue to Storage.

### 3 — `20260813043239_group_message_attachment_storage.sql`

Purpose: conflict-safe private bucket and immutable correlated Storage SELECT/INSERT policies.

Preconditions: Migrations 1–2 committed; proposed bucket absent; deployed Storage bucket columns and
`storage.objects` metadata conventions unchanged. Expected: private 25 MiB bucket, one definer helper,
two browser policies, and no UPDATE/DELETE policy. Explicit transaction automatically rolls back DB
changes on failure; no object bodies are created.

Verify:

```sql
select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets where id='group-message-attachments';
select policyname,cmd,roles from pg_policies
where schemaname='storage' and tablename='objects'
  and policyname like 'group_message_attachment%'
order by policyname;
```

Failure symptoms: conflicting bucket row, Storage schema drift or policy collision. Safe action: stop;
allow rollback. Never update a conflicting bucket to force compatibility.

### 4 — `20260813043246_group_message_transactional_send.sql`

Purpose: reconciliation outbox and reservation, trusted-validation and atomic-publication RPCs.

Preconditions: Migrations 1–3 committed; no RPC/outbox collisions; migration owner can bypass ordinary
RLS and FORCE RLS remains off. Expected: outbox enum/table/index and three definer RPCs with minimum
grants. Explicit transaction automatically rolls back on failure.

Verify:

```sql
select to_regclass('public.group_legacy_mirror_outbox');
select p.oid::regprocedure,pg_get_userbyid(p.proowner),p.prosecdef,p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('reserve_group_thread_message','mark_group_message_attachment_ready','publish_group_thread_message')
order by p.proname;
```

Failure symptoms: dependency/type error or ownership/grant mismatch. Safe action: stop after automatic
rollback. If already committed, do not drop outbox/drafts; use a reviewed forward correction.

### 5 — `20260813043253_group_message_moderation.sql`

Purpose: coordinated moderation/cancellation RPCs and audited legacy column-level INSERT privileges.

Preconditions: Migrations 1–4 committed; reply column names/types unchanged; current grants exported.
Expected: three definer RPCs; browser table INSERT/UPDATE/DELETE removed; authenticated INSERT retained
only for seven audited legacy columns. Explicit transaction automatically rolls back on failure.

Verify:

```sql
select grantee,privilege_type
from information_schema.table_privileges
where table_schema='public' and table_name='group_thread_messages'
  and grantee in ('anon','authenticated') order by grantee,privilege_type;
select grantee,column_name,privilege_type
from information_schema.column_privileges
where table_schema='public' and table_name='group_thread_messages'
  and grantee='authenticated' and privilege_type in ('INSERT','UPDATE')
order by privilege_type,column_name;
```

Failure symptoms: legacy message INSERT permission errors or unexpected grant diff. Safe action: stop.
If transaction failed, grants roll back. If committed, restore only the exported exact pre-deployment
grants via a reviewed corrective migration; never grant broad rights ad hoc.

### 6 — `20260813043307_group_message_cleanup_outbox.sql`

Purpose: cleanup enums/queues, discovery and lock/revalidation claim RPCs, plus publication cleanup guard.

Preconditions: Migrations 1–5 committed; no proposed collisions. Expected: two enums, two RLS queues,
three service-only definer RPCs, one invoker trigger function and one BEFORE trigger. No scheduler or
physical deletion is created. Explicit transaction automatically rolls back on failure.

Verify:

```sql
select to_regclass('public.group_attachment_cleanup_queue'),
       to_regclass('public.group_message_reservation_cleanup_queue');
select t.tgname,pg_get_triggerdef(t.oid,true)
from pg_trigger t
where t.tgrelid='public.group_thread_messages'::regclass and not t.tgisinternal
order by t.tgname;
```

Failure symptoms: queue/type collision or trigger dependency failure. Safe action: stop after automatic
rollback. If committed, leave queues/data intact and use a forward correction.

## Post-deployment read-only verification

Do not create messages or upload objects during catalog verification.

```sql
-- Migration history: confirm the six canonical versions once and in order.
select * from supabase_migrations.schema_migrations
where version in ('20260813043220','20260813043230','20260813043239',
                  '20260813043246','20260813043253','20260813043307')
order by version;

-- Exactly the five Phase 1.3B enums and their labels.
select n.nspname,t.typname,e.enumlabel,e.enumsortorder
from pg_type t join pg_namespace n on n.oid=t.typnamespace
join pg_enum e on e.enumtypid=t.oid
where n.nspname='public' and t.typname in
 ('group_message_attachment_type','group_message_attachment_status',
  'group_legacy_mirror_status','group_attachment_cleanup_reason',
  'group_attachment_cleanup_status')
order by t.typname,e.enumsortorder;
select schemaname,tablename,indexname,indexdef from pg_indexes
where schemaname='public' and indexname like 'group_%' order by indexname;

-- RLS for exactly the four Phase 1.3B tables.
select n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
 ('group_message_attachments','group_legacy_mirror_outbox',
  'group_attachment_cleanup_queue','group_message_reservation_cleanup_queue')
order by c.relname;
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where policyname in
 ('group_message_attachments_read','group_thread_messages_active_member_guard',
  'group_thread_messages_anonymous_deny','group_thread_messages_legacy_insert_guard',
  'group_message_attachment_objects_read','group_message_attachment_objects_insert')
order by schemaname,tablename,policyname;

-- Function owner/security/search_path and effective execution.
select n.nspname,p.oid::regprocedure,pg_get_userbyid(p.proowner) owner,
       p.prosecdef,p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','group_attachments_private')
  and (p.proname like '%group_message%' or p.proname in
   ('is_accepted_member','can_moderate','can_remove','object_authorized'))
order by n.nspname,p.proname;
select p.oid::regprocedure,r.rolname,has_function_privilege(r.oid,p.oid,'EXECUTE')
from pg_proc p cross join pg_roles r
where r.rolname in ('anon','authenticated','service_role')
  and p.proname in ('reserve_group_thread_message','mark_group_message_attachment_ready',
   'publish_group_thread_message','enqueue_due_group_attachment_cleanup',
   'claim_group_attachment_cleanup','claim_group_message_reservation_cleanup')
order by p.proname,r.rolname;

-- Trigger order is lexical for same timing/event.
select c.relname,t.tgname,pg_get_triggerdef(t.oid,true)
from pg_trigger t join pg_class c on c.oid=t.tgrelid
where not t.tgisinternal and c.relname in ('group_thread_messages','group_message_attachments')
order by c.relname,t.tgname;

-- Bucket must satisfy storage.buckets.public = false; this is the precise privacy assertion.
select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets where id='group-message-attachments';
select policyname,cmd,roles from pg_policies
where schemaname='storage' and tablename='objects'
  and policyname like 'group_message_attachment%'
order by policyname;

-- Realtime remains enabled for canonical messages.
select pubname,schemaname,tablename,rowfilter from pg_publication_tables
where schemaname='public' and tablename='group_thread_messages';

-- No cleanup scheduler was introduced. This first query is safe even when pg_cron is absent.
select to_regclass('cron.job') as cron_job_table;
```

Only if `cron_job_table` is non-null, run the following separately:

```sql
select jobid,schedule,command from cron.job
where command ilike '%group_attachment%' or command ilike '%reservation_cleanup%';
```

Also verify exact table/column grants using `information_schema.table_privileges` and
`column_privileges`. Confirm no proposed feature object beyond the inventory in the review document,
no PUBLIC execution on feature functions, and no browser mutation on queues/attachments.

Draft/cancelled invisibility is established by the restrictive policy definition without reading
message content. Operational verification may use controlled accounts only after separate smoke-test
authorization. Do not query production message bodies for verification.

## Rollback decision tree

### A. Failure before any migration commits

The active explicit transaction rolls back automatically. Confirm no proposed objects/history entry,
keep Group sending paused, preserve errors and investigate. No rollback SQL is needed.

### B. Failure after Migrations 1–3

The failing migration rolls back; earlier commits remain. If the foundation is healthy, prefer a
reviewed forward corrective migration or pause deployment with Group attachments unused. Because no UI
uses the foundation, application rollback is usually unnecessary. Destructive removal of attachment
schema/bucket requires explicit approval and proof the bucket is empty. Never delete the bucket based
only on expected emptiness.

### C. Failure after Migrations 4–6

Stop and retain canonical drafts, attachments, outbox and cleanup queues. Prefer a forward corrective
migration. Do not drop queues/outbox or delete their rows. Revoke a newly exposed callable RPC only via
an exact reviewed emergency privilege change. Application remains on pre-attachment behavior.

### D. Application regression while database foundation is healthy

Roll back the application release or disable the affected Group messaging feature. Leave the database
foundation in place; additive columns default safely and attachment UI is absent. Diagnose before any
database reversal.

### E. Security-policy regression

Immediately disable affected Group send/read paths, preserve evidence and compare policies/grants with
the pre-deployment export. Apply an exact reviewed policy/privilege restoration or forward correction.
Do not grant broad table rights as a shortcut.

### F. Storage-policy regression

Disable attachment-related endpoints (no Phase 1.3B UI should exist). Remove or correct only the two
named feature policies through a reviewed migration. Keep the private bucket and all objects. Never
delete or make the bucket public.

### G. Legacy-message compatibility regression

Pause Group sends, confirm Migration 5 grants and restrictive INSERT-policy composition. Restore only
the exact exported pre-deployment compatibility privileges/policies or deploy a forward correction.
Do not disable the published-message visibility guard and do not insert/rewrite legacy comments by hand.

### Destructive rollback boundary

Dropping columns/types/tables, removing the private bucket, deleting messages/drafts/attachments,
truncating outbox/queues or deleting Storage objects is destructive and requires a separate written
approval, dependency inventory, retention/legal review and tested script. PITR/logical restore is an
incident-level decision, not a routine migration rollback.

## Production smoke-test checklist

Use only pre-approved controlled accounts and synthetic/non-sensitive text. Do not test attachment
sending or upload; no attachment UI is expected.

- [ ] Accepted member opens a Group thread and sees existing published messages.
- [ ] Accepted member sends one controlled text-only Group message through the existing UI.
- [ ] Accepted member replies to that message; reply author/preview render correctly.
- [ ] Group owner/admin opens the thread and sees the controlled message/reply.
- [ ] Pending or unrelated account cannot open/read the Group thread or send into it.
- [ ] Group thread selection/navigation and ordering remain stable.
- [ ] Existing published INSERT appears through Realtime without refresh.
- [ ] Direct messaging regression check passes.
- [ ] Application messaging regression check passes.
- [ ] No attachment controls appear and no upload is attempted.
- [ ] API/database error rates and lock waits remain normal for 30 minutes.

Delete controlled smoke-test messages only through an already-approved normal application workflow;
do not issue cleanup SQL as part of this runbook.

## Incident and approval record

| Field | Value/signature |
|---|---|
| Change ticket | `[REQUIRED]` |
| Maintenance window | `[REQUIRED, timezone included]` |
| GO/NO-GO owner approval | `[NAME / DATE / SIGNATURE]` |
| Database operator approval | `[NAME / DATE / SIGNATURE]` |
| Independent verifier approval | `[NAME / DATE / SIGNATURE]` |
| QA approval | `[NAME / DATE / SIGNATURE]` |
| Communications confirmation | `[NAME / DATE / SIGNATURE]` |
| Rollback decision owner | `[NAME / CONTACT METHOD]` |
| Supabase support escalation route | `[REQUIRED]` |
| Application on-call route | `[REQUIRED]` |
| Security incident route | `[REQUIRED]` |
| Backup/PITR evidence location | `[RESTRICTED LOCATION]` |
| Execution transcript location | `[RESTRICTED LOCATION]` |
| Final outcome | `[GO / NO-GO / ROLLED BACK / FORWARD FIX]` |

## Preparation attestation

This document was prepared using local repository inspection and read-only production catalog
queries. Its preparation did not apply migrations, write database rows, change Supabase or Storage,
change Vercel, update PR #10, merge code, stage, commit or push anything.
