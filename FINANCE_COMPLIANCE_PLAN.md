# SMCF Finance & Compliance Center

## Status

Planning and integration design only. No financial records, SACCO balances,
payment callbacks, or existing transaction calculations are changed by this
plan.

## Existing SACCO Foundations

The SACCO backend is the source of truth and already provides:

- `Member`, `User`, and role-based authentication through
  `smcf-sacco-backend/src/middleware/auth.ts`.
- Canonical transactions through `src/models/Transaction.ts` and
  `src/routes/transactions.ts`.
- Existing SACCO financial statement computation, mappings, adjustments,
  history, approval/locking, and PDF exports through
  `src/models/FinancialStatement*.ts`, `src/routes/financialStatements.ts`,
  and the SACCO `Reports` page.
- Existing audit logging through `src/models/AuditLog.ts`,
  `src/middleware/auditLog.ts`, and `src/routes/auditLogs.ts`.
- Existing document records and member document uploads through
  `src/models/Document.ts` and the member routes.
- Existing notifications and M-Pesa verification flows.

The new module must consume these systems rather than create another member,
authentication, payment, or ledger system.

## Accounting Boundary

The module will maintain separate classifications and views for:

| Ledger boundary | Treatment |
| --- | --- |
| Member funds | Savings, shares, wallet balances, cycle contributions, payouts, and loan activity remain member/SACCO records. They are not automatically organizational revenue. |
| Organizational funds | Invoices, approved expenses, supplier balances, organizational income, tax records, and reconciliations are finance records. |
| Shared payment infrastructure | Existing M-Pesa and transaction records remain authoritative for payment verification. Finance records reference verified transactions. |

Historical corrections must create adjustment records and audit entries. The
system must not silently rewrite existing financial history.

## Phase 0: Safety Gate

Before production writes:

1. Back up the SACCO database, environment configuration, deployment files,
   and uploaded documents.
2. Verify the backup can be restored in a non-production database.
3. Confirm finance roles and approval owners with SMCF.
4. Confirm the organization's legal entity details, KRA PIN, tax registrations,
   accounting period, and accountant contact. The application stores supplied
   configuration; it does not determine legal tax obligations.

## Phase 1: Read-Only Finance Overview

Add a Finance & Compliance group to the existing SACCO admin navigation and a
read-only overview page first.

Initial sources:

- Existing verified SACCO transactions.
- Existing financial statement overview and report-pack endpoints.
- Existing audit-log counts and recent activity.
- Existing member/SACCO balances.

The overview should show period filters, organizational versus member-funds
breakdowns, pending finance work, compliance status, missing evidence, and
links to existing reports. It must not classify every deposit as income.

## Phase 2: Finance Configuration And Classifications

Add additive models and routes under the SACCO backend:

- `OrganizationFinanceProfile`: legal name, KRA PIN, entity type, accounting
  period, accountant, and eTIMS configuration status. Sensitive fields require
  role checks and should be masked in ordinary responses.
- `TaxObligation`: configurable obligation name, frequency, due-date rule,
  status (`active`, `inactive`, `not_applicable`, `under_review`), filing and
  payment evidence references, and review metadata.
- `FinanceTransactionClassification`: a reference to an existing verified
  transaction plus explicit classification (`member_savings`,
  `cycle_contribution`, `wallet_deposit`, `organizational_income`,
  `organizational_expense`, `fee`, and related categories). This is a
  classification layer, not a replacement transaction ledger.
- `ApprovalPolicy`: configurable finance approval thresholds and allowed
  roles.

All mutations use `protect`, `authorize`, `auditLog`, validation, and immutable
references. No route should accept a client assertion that a payment succeeded.

## Phase 3: Invoices, Receipts, Notes, And Expenses

Add separate finance records with controlled numbering:

- `Invoice`: draft/issued/paid/partially-paid/cancelled/credited states,
  customer details, line items, totals, payment references, and attachments.
- `Receipt`: generated only from a verified completed transaction or approved
  invoice settlement. Store internal receipt number separately from any M-Pesa
  or eTIMS reference.
- `CreditNote` and `DebitNote`: immutable adjustments linked to the original
  invoice, with reason and approval audit trail.
- `Expense`: supplier, category, amount, tax fields, payment reference,
  supporting document, approval status, and organizational classification.
- `Supplier`: contact, KRA PIN where supplied, payment details, documents,
  invoice history, and outstanding balance.

Use existing PDF utilities where possible. Label documents as internal SMCF
documents unless a real external eTIMS response has been stored.

## Phase 4: eTIMS And KRA Evidence

Implement eTIMS as an integration state machine, not a fake compliance claim:

- `not_submitted`
- `pending`
- `submitted`
- `accepted`
- `rejected`
- `error`

Store external request/reference/response metadata only when returned by an
approved integration. Never generate or display a fabricated eTIMS number.

Tax rules must be configurable by obligation and effective date. The system
may calculate reminders from configured rules, but must label outputs as
preparation support and require accountant/admin review.

## Phase 5: Compliance Calendar And Document Vault

Add configurable reminder intervals, obligation instances, document expiry
tracking, and admin notifications. Reuse the existing notification service and
document storage conventions. Document access must be role-scoped and download
events should be auditable where practical.

## Phase 6: Reconciliation And Reports

Add reconciliation sessions that compare imported or manually supplied
external balances against system totals without altering source records:

- system balance
- external balance
- difference
- status (`reconciled`, `investigation_required`, `pending`)
- evidence and reviewer

Finance reports should use existing statement computations where applicable and
add finance-specific reports for invoices, expenses, supplier payables, tax
preparation summaries, missing evidence, and reconciliation exceptions. Export
formats should reuse existing PDF/CSV patterns before adding Excel support.

## Phase 7: Member Documents And Payments

Only after admin flows are validated, add a member-facing Documents & Payments
area inside `MyAccount` for that member's invoices, receipts, statements, and
verified transactions. Do not expose tax profile, supplier data, internal
classifications, or organizational reports to members.

## Required API Groups

Mount additive routes in `smcf-sacco-backend/src/server.ts`:

- `/api/finance/overview`
- `/api/finance/profile`
- `/api/finance/classifications`
- `/api/finance/invoices`
- `/api/finance/receipts`
- `/api/finance/credit-notes`
- `/api/finance/debit-notes`
- `/api/finance/expenses`
- `/api/finance/suppliers`
- `/api/finance/tax-obligations`
- `/api/finance/etims`
- `/api/finance/calendar`
- `/api/finance/reconciliation`
- `/api/finance/documents`
- `/api/finance/audit`

Routes should be introduced in vertical slices, not as one large migration.

## Role Matrix

| Role | Access |
| --- | --- |
| Admin | Full finance configuration, approvals, corrections, and reports |
| Treasurer | Finance operations, approvals, reconciliations, reports |
| Auditor | Read-only finance, evidence, audit, and reports unless explicitly configured |
| Credit roles | Existing SACCO functions; no finance mutations by default |
| Member | Own invoices, receipts, statements, and verified transactions only |

Future configurable roles such as accountant or CEO should be added through the
existing `User.roles` authorization model rather than a second login system.

## First Implementable Slice

The first code slice should be a read-only `/api/finance/overview` endpoint and
an admin-only Finance & Compliance page backed by existing transactions and
financial statement summaries. It has no new financial writes, no eTIMS claim,
and no tax determination. This slice proves navigation, role protection,
period filtering, member-funds separation, and deployment without risking
production balances.

## Acceptance Checks

- Existing SACCO transactions and balances remain byte-for-byte unchanged.
- Member deposits, savings, wallet balances, and cycle contributions are not
  presented as organizational income without explicit classification.
- Finance routes reject member access and enforce staff roles.
- Every finance mutation creates an audit record and cannot silently delete
  history.
- Receipts require verified payment evidence.
- eTIMS status is explicit and never fabricated.
- Existing SACCO reports, payments, loans, savings, and member workflows pass
  regression tests.
- Production backup and restore evidence exists before enabling writes.