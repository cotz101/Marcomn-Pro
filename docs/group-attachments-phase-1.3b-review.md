# MarComn Phase 1.3B secure Group attachment foundation

Status: local design draft only. Baseline commit: `92bf0aa26388f3c44dac7bb30af7f1d927b46993`.
The ordered migration filenames were generated locally with the project-pinned Supabase CLI 2.114.0.
The Phase 1.3A live-schema audit, not `supabase_migration.sql`, is the
application baseline. In particular, deployed accepted membership is currently represented as
`group_members.status = 'member'`, and deployed `group_comments` has no `author_name`.
The completed read-only Phase 1.3B compatibility audit also confirmed that the deployed schema has no
`group_thread_messages` activity trigger and no `bump_thread_last_message_at` function.

## Review order and dependency map

1. `20260813043220_group_message_attachment_foundation.sql` — canonical `delivery_status`, enforced
   delivery transitions, normalized reservation request, NULL-total attachment evidence constraints,
   relationship/count triggers.
2. `20260813043230_group_message_attachment_authorization.sql` — feature-private authorization helpers,
   attachment RLS, authenticated published-message SELECT/legacy INSERT guards, and explicit anonymous
   deny. Depends on 1.
3. `20260813043239_group_message_attachment_storage.sql` — conflict-safe private bucket creation and
   correlated immutable-object policies. Depends on 1–2.
4. `20260813043246_group_message_transactional_send.sql` — fully normalized/concurrency-safe reservation,
   trusted evidence validation, locked publication, verified legacy mirror, and outbox. Depends on 1–3.
5. `20260813043253_group_message_moderation.sql` — lock-coordinated deletion/cancellation, published
   message invariant, and column-level legacy compatibility privileges. Depends on 1–4.
6. `20260813043307_group_message_cleanup_outbox.sql` — cleanup discovery, lock/revalidation claims,
   stale-job cancellation publication guard, and minimum worker grants. Depends on 1–5.

This order is exact and must not be parallelized or rearranged.

All migrations require a fresh live-schema diff immediately before approval. Confirm exact column
types, membership status/role check constraints, existing function/policy names, `storage.buckets`
columns/metadata keys, exact legacy reply columns, existing grants/policies, and whether
`group_comments.id = group_thread_messages.id` remains the compatibility key.
Confirm RLS is not FORCE-enabled for the migration-owner SECURITY DEFINER reservation RPC and that an
audited permissive authenticated INSERT policy remains: the new restrictive policy can narrow an
INSERT but cannot independently make one permissible.

## External-review hardening resolutions

1. Idempotency compares stored canonical JSON containing thread, trimmed content and every allowed
   field of every ordered attachment descriptor; descriptor IDs are mandatory and unique.
2. Message and attachment UUID advisory locks serialize retries/collisions before lookup and insert.
3. Service-only readiness records actual Storage MIME/size, SHA-256, inspector and bounded trusted
   evidence; actual values must match declaration and Storage metadata, including 10/25 MiB ceilings.
4. Publication and deletion lock message then all attachments; the final attachment-only ready item
   cannot be removed from a published message.
5. Cleanup enqueue is discovery only; claim RPCs lock/revalidate canonical state and cancel stale work.
6. Legacy browser INSERT is column-scoped and excludes delivery/request; broad and sensitive-column
   UPDATE privileges are revoked.
7. Anonymous message SELECT is subject to an explicit restrictive false policy.
8. Existing bucket configuration is compared exactly; conflict raises instead of mutating it.
9. Helpers use the dedicated `group_attachments_private` schema only.
10. Outbox/cleanup tables and worker RPCs have explicit minimum service-role grants.
11. A legacy ID conflict is compared to canonical post/user/content and mismatches enter the outbox.
12. Content and metadata length/JSON-complexity ceilings are database enforced.
13. Cleanup enqueue returns both newly inserted reservation and attachment job counts.
14. This document, matrix, worker contract, dependencies and rollback describe the corrected SQL.
15. Ready evidence is NULL-total: uploaded and link attachments have mutually exclusive required fields,
   explicit safe evidence and bounded inspector identity/inspection JSON.
16. A database trigger permits only same-status updates, draft→published and draft→cancelled; terminal
   published/cancelled states cannot be reopened or crossed.
17. Legacy authenticated INSERT is additionally constrained by restrictive RLS to caller authorship,
   published/default delivery, null reservation data, active thread and current Group membership/owner.

## Design summary

`group_message_attachments` is deliberately separate from generic `message_attachments`. Uploaded
files have bucket/path/MIME/size and no URL; links have HTTPS URLs and no Storage fields. Relationship
and five-active-item limits are enforced server-side under an advisory transaction lock. The unique
path is `{group_id}/{thread_id}/{uploader_id}/{attachment_id}/{generated_uuid}.{safe_extension}`;
original filenames are metadata only. Both declared and actual image size are capped at 10 MiB;
declared and actual document size are capped at 25 MiB. Content, filename, title, URL, path, preview,
inspection and error fields have explicit length/serialized-size ceilings; preview and inspection JSON
are also capped at 100 recursively selected JSON nodes.
Macro formats, video, SVG, HTML/XML, archives, and executables are absent from the allowlist.

The bucket is private. SELECT and INSERT correlate the whole path to attachment, canonical message,
active thread, group, current membership, and current uploader; there is no client UPDATE or DELETE
policy, so `upsert: false` is an application requirement reinforced by the absence of UPDATE rights.
Signed URLs must be issued by trusted server code after the same authorization check: 5 minutes for
inline images and 15 minutes for explicit document downloads. No signed URL is persisted.

The message UUID is the idempotency key. Every descriptor requires a caller UUID. Reservation builds
and stores a canonical JSON request containing normalized text, thread and the complete ordered list
of allowed descriptor fields. Unknown fields are rejected. A transaction advisory lock serializes
same-UUID calls before lookup/insert: an exact normalized retry returns authoritative rows; any mismatch
is rejected without exposing a unique-key race. The client uses returned paths with `upsert:false`.

Publication locks the message and every attachment in stable ID order, requires all active attachments
ready, and requires non-empty text or an active ready attachment. Attachment deletion follows the same
lock order and rejects removal of the final active ready attachment from attachment-only published
messages. Legacy mirroring occurs only after publication; an existing `group_comments` ID is read back
and compared to canonical post/user/content. `group_comments.post_id` references `group_posts.id`, not
`group_threads.id`, so a canonical thread can mirror only when a compatible same-ID `group_posts` row
exists. If it does not, the foreign-key failure is caught, canonical publication remains successful,
and the durable reconciliation outbox receives the failure. Missing, conflicting, or otherwise failed
mirrors likewise enqueue reconciliation. The future reconciliation worker must classify “no compatible
legacy post” as a bounded terminal disposition and must not retry it indefinitely.

Uploaded descriptors begin `pending`. The service-only validator stores inspector identity, SHA-256,
actual MIME/size and bounded inspection evidence. It locks the row and requires actual values to match
both declared metadata and `storage.objects.metadata`, requires magic-byte evidence, Office-container
evidence where applicable, safe/polyglot inspection, and actual 10/25 MiB ceilings. Link evidence must
contain the exact canonical URL and SSRF-safe result while file-only evidence remains null. Both the
function and table constraint explicitly reject missing/null ready evidence; inspection JSON remains
limited to 16 KiB/100 nodes and inspector identity to 200 characters. The live audit must confirm
Storage metadata keys.

### Approved reservation and publication lifecycle

The smallest design is one added canonical column rather than a separate reservation table:
`group_thread_messages.delivery_status` is constrained to `draft`, `published`, or `cancelled` and
defaults to `published` for existing/legacy clients. A restrictive SELECT policy requires
`published`, so drafts and cancellations are absent from normal conversation queries and Realtime
row visibility. The deployed schema has no `group_thread_messages` activity trigger, and Phase 1.3B
intentionally leaves legacy direct-INSERT activity behavior unchanged: it does not add a privileged
legacy INSERT trigger. Canonical reserved messages update `group_threads.last_message_at` only after
successful publication through `publish_group_thread_message`; hidden draft reservations never change
thread activity and cannot reorder the visible thread list or leak draft activity. Reservation creates
the draft and metadata; immutable upload is permitted only for
the draft author and pending record; trusted validation marks every descriptor ready; publication
then atomically changes the row to published and performs the legacy mirror/outbox step. Partial,
failed, abandoned and cancelled reservations never satisfy publication. Draft/cancelled objects are
cleanup-eligible after 24 hours. Finalization and cancellation are idempotent.

The delivery transition trigger allows INSERT only as a draft with reservation data (needed for the
definer reservation RPC) or published with null reservation data (the legacy default), same-status
updates, `draft→published`, and `draft→cancelled` only.
It rejects `published→draft/cancelled`, `cancelled→draft/published`, null/unknown states, and any other
transition. It is an earlier migration dependency and composes with the later publication-cleanup
BEFORE trigger; both must approve publication.

Authenticated compatibility clients lose table-level INSERT/UPDATE/DELETE. They receive INSERT only
on audited legacy columns and cannot name `delivery_status` or `reservation_request`; those use secure
defaults. A restrictive INSERT policy independently requires caller authorship, published status, null
reservation request, active thread and current accepted membership/ownership; the SECURITY DEFINER
reservation RPC bypasses browser RLS to create drafts. All column-level UPDATE on identity/content/status fields is explicitly revoked. Anonymous
SELECT receives a restrictive `USING (false)` guard, so no permissive legacy policy can expose drafts.

Publication is an UPDATE event, not INSERT. Phase 1.3C must subscribe to qualifying UPDATE events (or
refetch after its own successful publish RPC) in addition to INSERT so another member sees a newly
published reserved message in real time. RLS prevents the prior draft state from being delivered.
Phase 1.3C should use resumable/TUS uploads for files above 6 MiB while retaining the immutable
server-generated object path and `upsert:false`.

## Security matrix

Legend: Y allowed; Own accepted membership required; Mod owner or accepted admin/moderator; S trusted
service only; N denied. Owners are allowed by the explicit owner rule even without a membership row.

| Actor | Read published | Reserve RPC | Legacy published INSERT | Read metadata | Create metadata | Upload draft | Validate | Publish ready draft | Signed URL | Delete own | Moderate | Physical cleanup |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Group owner | Y | Y | Own/active Group | Y | RPC | Own | N | Y | Y | Own | Y | N |
| Accepted admin | Y | Y | Own/active Group | Y | RPC | Own | N | Y | Y | Own | Y | N |
| Accepted moderator | Y | Y | Own/active Group | Y | RPC | Own | N | Y | Y | Own | Y | N |
| Accepted member | Y | Y | Own/active Group | Y | RPC | Own | N | Y | Y | Own | N | N |
| Pending member | N | N | N | N | N | N | N | N | N | N | N | N |
| Banned member | N | N | N | N | N | N | N | N | N | N | N | N |
| Removed/former member | N | N | N | N | N | N | N | N | N | N | N | N |
| Unrelated authenticated | N | N | N | N | N | N | N | N | N | N | N | N |
| Anonymous | N | N | N | N | N | N | N | N | N | N | N | N |
| Trusted validator/worker | controlled | N | N | controlled | N | N | S with evidence | N | controlled | N | controlled | claim + revalidate |

Message SELECT policies from the Phase 1.3A normalized-message work must independently enforce active
accepted membership and `is_deleted = false`; verify that before deployment. Signed-URL server code
must call equivalent authorization and must not treat possession of a path as authority.

## Legacy public bucket audit (read-only plan)

Do not change `group-attachments`, its 19 known objects, generic `message_attachments`, or existing
rows. Before any later migration, export read-only object metadata (name, bucket, owner, MIME, size,
created/updated timestamps and custom metadata) and inspect legacy `group_posts`, `group_comments`,
generic attachment rows and application references. Candidate matching should use exact stored URL/path
first, then object metadata and timestamps; filename-only or proximity matches are evidence, never proof.
Record unmatched, multiply matched and cross-group candidates. Verify ownership/membership at creation,
public URL usage, retention/legal obligations, duplicates and references outside Group discussion.
Nothing should be deleted automatically because public objects may have external consumers, historical
rows are incomplete, filenames are non-unique, and an incorrect match is irreversible.

## Rollback plan

| Migration | Forward action | Safe rollback | Data-loss risk | Transactional? | Storage cleanup | Older clients |
|---|---|---|---|---|---|---|
| 1 | status/request/evidence columns, delivery-transition and attachment-integrity triggers, attachment objects | Disable reservation/validation first; export drafts/evidence; remove dependent triggers/functions before columns; no activity trigger exists to restore | High if rows/drafts exist | Catalog rollback yes | None | Existing direct-INSERT activity behavior is unchanged; clients use published default |
| 2 | feature schema, helpers and SELECT/INSERT guards | Drop named policies, then dependent functions/schema | Low | Yes | None | Restore only audited former policies |
| 3 | private bucket/policies | Drop only named policies; retain bucket and inventory objects; remove bucket row only when proven empty | High if bucket removed | Policies yes; object deletion no | Separate, explicit and reviewed | Unaffected |
| 4 | reservation/validation/publication RPCs and legacy outbox | Revoke RPCs; stop validator; drain/export outbox and inspection evidence; retain hidden drafts | High if drafts/outbox dropped | Functions yes | Draft objects need reviewed cleanup | Existing text clients continue |
| 5 | coordinated delete/cancel RPCs and compatibility grants | Revoke RPCs; restore only grants captured in the live privilege audit | Medium if legacy clients depend on unknown columns | Yes | Files remain retained | Reply-column assumption must be verified |
| 6 | queues, claim RPCs and publication guard | Stop workers; resolve processing leases; drop trigger/functions; export queues before removal | High if processing/history discarded | DB objects yes | Never bulk-delete during rollback | Unaffected |

Rollback scripts are intentionally not provided as executable broad drops. Generate them from the
approved live diff, target these exact names, and inventory dependent rows/objects first. Already
soft-deleted data and queued objects are retained; rollback never restores physical files automatically.

## Worker and retention contract

Enqueue is discovery only and returns the sum of newly inserted reservation plus attachment jobs;
conflicts are not counted. Workers may locate candidates with `FOR UPDATE SKIP LOCKED`, but must call
the service-only claim RPC immediately before physical deletion. Claim serializes the job, locks the
current message then all attachments, rechecks path, status, delivery state and 24-hour/30-day clocks,
and returns deletion coordinates only after changing the job to `processing`. Missing or stale canonical
state is cancelled, never deleted. Publication uses the same lock order, cancels pending stale jobs and
fails while cleanup is processing. Any future restore RPC must likewise reject/cancel processing work.
Workers use bounded retries, exponential backoff, leases and dead-letter state; object-not-found is
idempotent success. The future completion operation must lock the claimed job and allow only:
`processing→succeeded` after confirmed deletion or object-not-found; `processing→failed` with a bounded
error, incremented retry count and capped exponential `next_attempt_at`; stale `processing` lease
recovery back to `failed`; and retry-limit exhaustion to terminal `dead_letter`. Completion must reject
non-processing jobs and mismatched worker/lease tokens. No scheduler, Edge Function, completion RPC,
or physical deletion is implemented in this phase.

## SECURITY DEFINER inventory

| Migration | Function | Caller | Why definer is required | Internal authorization |
|---|---|---|---|---|
| 2 | `group_attachments_private.is_accepted_member(uuid,uuid)` | authenticated/service | Non-recursive membership lookup | Non-null user; owner or status `member` |
| 2 | `group_attachments_private.can_moderate(uuid,uuid)` | authenticated/service | Non-recursive role lookup | Owner or accepted admin/moderator |
| 2 | `group_attachments_private.can_remove(uuid,uuid)` | authenticated/service | Cross-table authorization | Accepted uploader/author or moderator |
| 3 | `group_attachments_private.object_authorized(uuid,text,boolean)` | Storage RLS | Protected correlated lookup | Full path/scope/member/draft-state checks |
| 4 | `reserve_group_thread_message(uuid,uuid,text,jsonb)` | authenticated | Narrow atomic writes while direct attachment mutation is denied | `auth.uid`, active membership, own author, idempotency |
| 4 | `mark_group_message_attachment_ready(uuid,text,bigint,text,jsonb,text)` | service role only | Trusted validator records evidence | Locked draft; actual Storage metadata and content evidence match |
| 4 | `publish_group_thread_message(uuid)` | authenticated | Atomic protected publication and legacy/outbox write | `auth.uid`, ownership, membership, all-ready gate |
| 5 | `soft_delete_group_message(uuid)` | authenticated | Narrow protected mutation | Accepted author or owner/admin/moderator |
| 5 | `soft_delete_group_message_attachment(uuid)` | authenticated | Narrow protected mutation | Accepted uploader/author or moderator helper |
| 5 | `cancel_group_message_reservation(uuid)` | authenticated | Narrow draft-only mutation | Draft author, accepted membership, idempotent cancel |
| 6 | `enqueue_due_group_attachment_cleanup(timestamptz)` | service role only | Protected queue population | Fixed eligibility predicates; no deletion |
| 6 | `claim_group_attachment_cleanup(uuid,text,timestamptz)` | service role only | Locked pre-delete revalidation | Current path/status/retention/delivery eligibility |
| 6 | `claim_group_message_reservation_cleanup(uuid,text,timestamptz)` | service role only | Locked reservation cleanup claim | Still hidden and older than 24 hours |

Trigger functions in migration 1 (`enforce_group_thread_message_delivery_transition`,
`enforce_group_message_attachment_relationship`, `enforce_group_message_attachment_limit`) and
migration 6 (`group_attachments_private.guard_message_publication_cleanup`) are SECURITY INVOKER,
have fixed search paths, have PUBLIC EXECUTE revoked, and are invoked only by their triggers.

## Explicit grants and revocations

| Object | PUBLIC | anon | authenticated | service_role |
|---|---|---|---|---|
| `group_message_attachments` | ALL revoked | ALL revoked | SELECT only | Supabase administrative role; verify live defaults |
| `group_legacy_mirror_outbox` | ALL revoked | ALL revoked | ALL revoked | SELECT/INSERT/UPDATE |
| Attachment and reservation cleanup queues | ALL revoked | ALL revoked | ALL revoked | SELECT/INSERT/UPDATE |
| `group_attachments_private` schema | ALL revoked | ALL revoked | USAGE only | USAGE |
| Three migration-2 private authorization helpers | EXECUTE revoked | none | EXECUTE granted for policy evaluation | inherited/admin |
| Private Storage authorization helper | EXECUTE revoked | none | EXECUTE granted for policy evaluation | inherited/admin |
| Reservation RPC | EXECUTE revoked | none | EXECUTE granted | inherited/admin |
| Validator-ready RPC | EXECUTE revoked | none | none | EXECUTE granted |
| Publication RPC | EXECUTE revoked | none | EXECUTE granted | inherited/admin |
| Message/attachment soft-delete RPCs | EXECUTE revoked | none | EXECUTE granted | inherited/admin |
| Reservation-cancel RPC | EXECUTE revoked | none | EXECUTE granted | inherited/admin |
| Cleanup enqueue RPC | EXECUTE revoked | none | none | EXECUTE granted |
| Cleanup attachment/reservation claim RPCs | EXECUTE revoked | none | none | EXECUTE granted |
| `group_thread_messages` mutation | no new rights | INSERT/UPDATE/DELETE revoked | INSERT only on audited legacy columns; no delivery/request column; UPDATE/DELETE revoked | admin |
| `storage.objects` new bucket | no new grants | no policy | SELECT/INSERT only when correlated policy passes; no UPDATE/DELETE | Storage service/admin |

RLS policy inventory:

- `group_message_attachments_read`: authenticated current-member read of active published content only.
- `group_thread_messages_active_member_guard`: restrictive authenticated published/active/member SELECT.
- `group_thread_messages_anonymous_deny`: restrictive anonymous SELECT denial.
- `group_thread_messages_legacy_insert_guard`: restrictive authenticated own-author, published,
  reservation-null, active-thread, accepted-member/owner INSERT.
- `group_message_attachment_objects_read`: correlated authenticated Storage SELECT.
- `group_message_attachment_objects_insert`: correlated pending-draft immutable Storage INSERT.

Every function fixes `search_path`; RLS authorization helpers live in the feature-specific non-exposed
`group_attachments_private`
schema. The callable public SECURITY DEFINER RPCs are an explicit narrow-
mutation exception and must be owned by a non-login migration owner, retain PUBLIC revocation, and be
checked with database advisors before application. Service-role credentials must never reach clients.

## Static review checklist

- Confirm enum/type and table names do not exist live; use guarded upgrade SQL if they do.
- Confirm the deployed schema still has no message activity trigger; Phase 1.3B must not introduce one.
- Confirm only `publish_group_thread_message` updates `group_threads.last_message_at`, after the
  canonical delivery transition succeeds, and hidden drafts never update thread activity.
- Confirm every `SECURITY DEFINER` has fixed `search_path`, PUBLIC EXECUTE revocation, and minimum grant.
- Confirm helper ownership is a non-login migration owner and users cannot mutate referenced tables.
- Confirm old broad message/attachment policies by live name and replace them explicitly.
- Confirm the legacy permissive message INSERT policy exists and is compatible with the new restrictive
  guard; otherwise add an explicitly reviewed permissive membership policy in the application migration.
- Confirm `group_thread_messages` does not FORCE RLS against the intended definer RPC owner.
- Test owner/member/admin/moderator/pending/banned/former/unrelated/anonymous cases in an isolated clone.
- Test cross-group IDs, forged path segments, fifth/sixth concurrent inserts and soft-deleted parents.
- Test idempotent same-key retry and hostile key reuse; verify legacy exception persists exactly one job.
- Verify Office macro MIME/extension/container rejection and 10/25 MiB boundaries in trusted validation.
- Test null inspection JSON, null safe/magic/canonical/SSRF evidence, null file actual metadata, and
  link rows carrying file-only evidence; every ready transition must fail closed.
- Test every delivery edge: same-state, draft→published/cancelled allowed; both terminal states reject
  reopening/crossing; compatibility INSERT publishes and reservation RPC inserts a hidden draft.
- Test compatibility INSERT impersonation, draft/status injection, reservation injection, archived/
  deleted threads, former membership, and cross-Group thread IDs.
- Verify the delivery-transition and publication-cleanup BEFORE triggers both approve publication and
  pending/processing cleanup behavior remains atomic; neither trigger updates thread activity.
- Test legacy mirroring with and without a compatible same-ID `group_posts` row; require canonical
  success plus one durable reconciliation job for the latter, and a bounded non-retrying worker disposition.
- Specify and test future worker completion/lease-token transitions before implementing physical cleanup.
- Verify Phase 1.3C selects resumable/TUS above 6 MiB without changing generated paths or `upsert:false`.
- Verify signed URL expiry and re-authorization; never expose service-role credentials to clients.
- Confirm `storage.objects.metadata` uses `size` and `mimetype` for this deployed Storage version.
- Inventory table-level and column-level grants before migration 5; confirm reply column names/types.
- Confirm no existing schema/type/policy/function/bucket name conflicts and compare an existing bucket exactly.
