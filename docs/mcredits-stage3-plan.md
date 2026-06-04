# MarComn MCredits Roadmap

## Current Stable State

### Stage 1 Complete

* MCredit wallets
* Personal wallet
* Company wallet
* Platform wallet
* Ledger transactions
* Admin grant/deduct controls
* Auto wallet creation
* Platform settings

### Stage 2 Complete

* Company job posting fee deduction
* Personal job posting fee deduction
* Fee preview
* Insufficient balance protection
* Offer expiry duration
* Candidate acceptance fee deduction
* Company wallet page
* Personal wallet page
* Identity separation
* Company attribution in Logbook
* Company attribution in Opportunity list

### Stage 3A Complete

* Job Orders
* Active Engagement creation after offer acceptance

### Stage 3B Complete

* Candidate cancellation workflow
* Cancellation reason capture
* Company notification
* Cancellation tracking
* Feedback preparation
* Reputation preparation

---

## Confirmed Business Rules

### Identity Model

* One login account
* One personal profile
* One company membership only
* Separate personal wallet
* Separate company wallet

### Job Posting

Personal posting:

* Deduct from personal wallet

Company posting:

* Deduct from company wallet

Posting fee percentage:

* Controlled via platform settings
* Not hardcoded

### Job Offer

* Company sends offer
* Offer expiry configurable
* Candidate charged only when accepting
* Expired offers cannot be accepted

### Opportunity Behavior

Accepted candidate DOES NOT automatically close the job.

Recommended display:

* Hiring In Progress

Job remains open until company manually closes it.

### Candidate Cancellation

Candidate may cancel after accepting.

Required:

* Cancellation reason

Optional:

* Remarks

Company receives:

* Platform notification

Prepared:

* is_excused
* excused_by
* excused_reason

No refund logic implemented yet.

---

## Remaining Work

### Stage 3C

Company Cancellation

### Stage 3D

Refund & Penalty Distribution

Candidate Cancels:

* Company refunded posting fee
* Company receives candidate penalty credits
* Platform receives platform share
* Candidate receives no refund

Company Cancels:

* Candidate receives acceptance fee refund
* Company receives no refund

All percentages configurable from platform settings.

### Stage 3E

Trust & Reputation

Candidate Profile:

* Completed Jobs
* Cancelled Jobs
* Excused Cancellations

Company Feedback:

* Tied to job order
* Tied to application
* Tied to candidate

Feedback presets:

* Late Communication
* Unprofessional Conduct
* No Show
* Accepted Then Cancelled
* Poor Communication
* Other

---

## Last Verified Test Results

PASS:

* Company wallet deduction
* Personal wallet deduction
* Insufficient balance protection
* Offer expiry
* Offer acceptance deduction
* Job order creation
* Active Engagement
* Candidate cancellation
* Company notification
* Company visibility of cancellation reason
* Identity separation
* Logbook attribution
* Opportunity attribution

No refund/penalty logic implemented yet.

---

This document becomes the official restart/recovery checkpoint.
