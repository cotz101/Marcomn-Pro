# Stage 3E Tasks (Completed)
- `[x]` Execute database schema updates (`candidate_reputation_summary`, `job_feedback`)
- `[x]` Create `app/actions/reputation.js`
- `[x]` Update candidate cancellation logic to refresh reputation
- `[x]` Update `applicants/page.jsx` for company "Mark Completed" & Feedback Modal
- `[x]` Update `Profile.jsx` to display Trust & Reputation section
- `[x]` Update `my-applications/page.jsx` for the Completed status styling
- `[x]` Build and verify with `npm run build`

# Batch 4A Tasks (Completed)
- `[x]` Improve Notifications page usability with horizontal pill-type filters
- `[x]` Categorize notifications into: Applications, Offers, Engagements, Wallet, Mentions, Groups, Messages, System
- `[x]` Deep-link Mentions to Logbook with `?focus=postId` temporary pulsing highlight
- `[x]` Deep-link Mentions for Group threads gracefully
- `[x]` Verify zero regression across notifications and existing deep links

# Future Stage — Job Completion & Payment Confirmation Flow (Planned)
**Important distinction:**
- *Close Job Posting* is NOT the same as closing an accepted engagement. The "Close Job" button stops new applicants, and shouldn't be treated as cancelling a specific applicant engagement. Engagement/job-order lifecycle should evolve separately.

## Future real-world flow
1. Company posts job -> Applicant applies -> Company sends offer -> Applicant accepts offer -> Active Engagement / Job Order created
2. Applicant performs the job -> Applicant marks work completed
3. Company confirms work completed
4. Company pays applicant directly **outside** MarComn
5. Applicant confirms payment received
6. Company/job poster closes the engagement/job order (or system marks closed when both confirmed)
7. Reputation and feedback finalize

## Future engagement statuses
Engagement/job-order statuses should support:
- Active
- Work Completed by Applicant
- Completion Confirmed by Company
- Payment Confirmed by Applicant
- Completed / Closed
- Candidate Cancelled
- Company Cancelled

**Payment Rule:** MarComn does not pay the applicant inside the platform at this stage. The company pays the applicant directly outside MarComn.

**Final Closure:** Applicant should not independently close the engagement.
