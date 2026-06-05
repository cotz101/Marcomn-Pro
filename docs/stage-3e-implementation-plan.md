# MarComn Stage 3E — Trust & Reputation Foundation

Stage 3E is already implemented and manually tested.

## Final Implemented Behavior
- Company can mark an Active Engagement as Completed.
- Feedback modal opens.
- Sentiment is required.
- Tags are optional.
- Comment is optional.
- Job order status becomes Completed.
- Application status becomes Completed.
- Candidate profile Trust & Reputation updates.
- Completed Jobs count updates.
- Cancelled Engagements count updates when candidate cancels.
- Completion Rate recalculates correctly.
- Company Cancelled does not reduce candidate reputation by default.
- Recent company feedback appears on candidate profile.
- No wallet movement occurs from Mark Completed or feedback submission.

## Database Updates

Using the Supabase MCP `execute_sql` tool, we will run the following SQL to ensure tables are ready:

```sql
ALTER TABLE candidate_reputation_summary 
ADD COLUMN IF NOT EXISTS completion_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS feedback_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS positive_feedback_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS negative_feedback_count integer DEFAULT 0;

ALTER TABLE job_feedback 
ADD COLUMN IF NOT EXISTS feedback_sentiment text,
ADD COLUMN IF NOT EXISTS feedback_tags text[],
ADD COLUMN IF NOT EXISTS feedback_comment text,
ADD COLUMN IF NOT EXISTS feedback_context text;
```

## Trust & Reputation Rules
1. **Completed Job**
- Increments completed_jobs
- Updates completion rate
- Allows company feedback tied to job_order

2. **Candidate Cancelled**
- Increments cancelled_jobs
- Updates completion rate
- Company may provide feedback later if needed

3. **Company Cancelled**
- Does NOT increase candidate cancelled_jobs by default
- Does NOT reduce candidate completion rate by default
- Company cancellation reason still displays to the candidate
- Refund/no-refund logic remains handled by Stage 3D

4. **Completion Rate**
Formula: `completed_jobs / (completed_jobs + cancelled_jobs) * 100`
If `completed_jobs + cancelled_jobs = 0`, UI displays "No engagement history yet." or "N/A" rather than 100%.

> [!IMPORTANT]
> Stage 3E does not trigger MCredit transfers, refunds, platform revenue, penalty distribution, or payment gateway logic. Wallet and financial logic remains handled in Stage 3D.

## Verification Plan

### Manual Verification
1. Open a completed job posting as a company. Select an active applicant and click "Mark Completed".
2. Fill out positive feedback in the modal and submit.
3. Verify the engagement status changes to `Completed` on both company and candidate sides.
4. Verify the Candidate's profile now shows the Trust & Reputation section with the updated completed job count, recalculated completion rate, and the new feedback.
5. Have the candidate cancel an active engagement.
6. Verify the candidate's profile updates to reflect the cancellation, recalculating and lowering their completion rate.

---

# Future Stage — Job Completion & Payment Confirmation Flow (Planned Next Phase)

**Note:** This section documents the next planned workflow stage. It is **NOT** to be implemented until explicitly instructed.

**Important distinction:**
- *Close Job Posting* is not the same as closing an accepted engagement. The "Close Job" button in My Job Postings should remain a job-posting-level action. It closes the vacancy/posting and stops new applicants. It should not be treated as cancelling or completing a specific applicant engagement. Engagement/job-order lifecycle should evolve separately.

## Current vs. Future Flow

- **Current Simplified Flow (Stage 3E)**: Allows company to mark an active engagement as Completed and submit feedback directly. This serves as our foundation.
- **Future Real-World Flow**:
  1. Company posts job -> Applicant applies -> Company sends offer -> Applicant accepts offer -> Active Engagement / Job Order created
  2. Applicant performs the job
  3. Applicant marks work completed
  4. Company confirms work completed
  5. Company pays applicant directly **outside** MarComn
  6. Applicant confirms payment received
  7. Company/job poster closes the engagement/job order (or system marks closed when both confirmed)
  8. Reputation and feedback finalize

## Future Engagement Statuses
Engagement/job-order statuses will eventually need to support:
- Active
- Work Completed by Applicant
- Completion Confirmed by Company
- Payment Confirmed by Applicant
- Completed / Closed
- Candidate Cancelled
- Company Cancelled

## Payment Rule
MarComn does not pay the applicant inside the platform at this stage. The company pays the applicant directly outside MarComn. The applicant should confirm payment received before the engagement is finally closed.

## Final Closure
The applicant should not independently close the engagement. The recommended final flow requires the applicant to confirm payment received, and then the company/job poster closes the engagement (or the system marks it closed after both sides confirm completion and payment).
