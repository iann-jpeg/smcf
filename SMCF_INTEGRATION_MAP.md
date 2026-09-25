# SMCF Integration Map

## Scope

This map covers the current SACCO frontend/backend, the legacy wallet and
cycles frontend/backend, their authentication boundaries, and the safest
integration sequence. It is based on the source currently in this repository.

## Current Components

| Area | Frontend | Backend | Current identity |
| --- | --- | --- | --- |
| SACCO member and staff portal | `sacco/src/App.tsx`, `sacco/src/components/DashboardLayout.tsx`, `sacco/src/components/AppSidebar.tsx` | `smcf-sacco-backend/src/server.ts` | `User` JWT in `smcf_auth_token`; member resolved through `Member.userId` |
| SACCO member account | `sacco/src/pages/MyAccount.tsx`, `sacco/src/hooks/useMyAccount.ts` | `/api/members/me`, `/api/transactions`, `/api/savings-history`, `/api/loans`, `/api/repayments` | SACCO `User` identity |
| SACCO payments | `sacco/src/components/DepositSavingsDialog.tsx`, `sacco/src/lib/paymentApi.ts` | `smcf-sacco-backend/src/routes/mpesa.ts`, plus the `/api/sacco-payments` bridge | SACCO JWT for direct M-Pesa routes; `x-sacco-key` for the bridge |
| Legacy wallet | `src/components/MemberWallet.tsx`, `src/components/admin/SavingsTab.tsx` | `backend/routes/savings.js`, `backend/models/Saving.js`, `backend/models/TransactionFee.js` | legacy member JWT in `smcf_token` |
| Legacy cycles | `src/components/MemberDashboard.tsx`, `src/components/CycleQRPayment.tsx` | `backend/routes/cycles.js`, `backend/models/Cycle.js`, `backend/models/Payment.js` | legacy member JWT in `smcf_token` |
| Legacy admin overview | `src/components/AdminDashboard.tsx` | `backend/routes/cycles.js`, `backend/routes/payments.js`, `backend/routes/savings.js` | legacy admin JWT in `smcf_token` |

## Route And UI Ownership

The SACCO application is the appropriate host shell:

- `sacco/src/App.tsx` owns authenticated routes and the `DashboardLayout`.
- `sacco/src/components/AppSidebar.tsx` owns member and staff navigation.
- `sacco/src/pages/MyAccount.tsx` already presents savings, transactions, loans,
  and profile data in one member account surface.
- `sacco/src/pages/MemberDetail.tsx` is the existing admin member profile and
  is the natural location for wallet/cycle summary sections.

The legacy wallet/cycle UI is reusable only after its API calls are made
compatible with the SACCO identity. Copying the components before solving
authorization would create a second login boundary or expose the wrong member.

## API And Data Map

### SACCO API

Mounted in `smcf-sacco-backend/src/server.ts`:

- `/api/auth`
- `/api/members`
- `/api/transactions`
- `/api/repayments`
- `/api/savings-history`
- `/api/loans`
- `/api/mpesa`
- `/api/shares`
- `/api/notifications`
- `/api/dashboard`

The SACCO `Member` model is in
`smcf-sacco-backend/src/models/Member.ts`. Its central relationship is
`userId`, with `memberId`, `email`, and `phone` available for reconciliation.

### Wallet And Cycles API

Mounted in `backend/server.js`:

- `/api/auth`
- `/api/members`
- `/api/payments`
- `/api/lipia`
- `/api/cycles`
- `/api/savings`
- `/api/sacco-payments`

The legacy wallet data is represented by `backend/models/Member.js` wallet
fields, `Saving`, and `TransactionFee`. The cycle data is represented by
`Cycle`, `Payment`, and legacy `Member` fields such as `position`,
`total_cycle_contribution`, and `next_payout_cycle`.

## Identity Findings

There are currently two incompatible member authentication paths:

1. SACCO login in `smcf-sacco-backend/src/routes/auth.ts` authenticates a
   `User` by email and issues a JWT containing the user ID. SACCO protected
   routes resolve the member with `Member.userId`.
2. Legacy login in `backend/routes/auth.js` authenticates a legacy `Member` by
   phone and issues a JWT containing the member document ID. Legacy protected
   routes resolve `req.member` directly from that ID.

The same logical MongoDB member collection may be involved, but the schemas
use different field names and the token subjects are not interchangeable. A
frontend-only merge is therefore insufficient for secure wallet/cycle access.

The preferred reconciliation key is the SACCO `Member.memberId`, with phone
and email used as secondary evidence. The integration must verify uniqueness
and document any unmatched or ambiguous records before enabling writes.

## Payment Findings

- SACCO savings deposits use `/api/mpesa/deposit` and poll
  `/api/mpesa/status/:checkoutRequestId`.
- Legacy wallet/cycle payments use `/api/payments`, `/api/payments/stk-push`,
  `/api/lipia`, and Socket.IO payment events.
- `/api/sacco-payments/initiate` is a bridge protected by `x-sacco-key`, not a
  member session token.

These flows must remain separate until a server-side identity bridge explicitly
maps the authenticated SACCO member to the existing legacy member record.
Payment callbacks and duplicate-payment safeguards must remain owned by their
existing services.

## Safe Integration Plan

1. **Inventory and backup gate**: export production database, environment
   configuration, source, deployment configuration, and payment configuration
   before production changes. No production backup credentials are available
   in this repository, so this step must be performed by the deployment owner.
2. **Identity reconciliation**: add a read-only diagnostic that compares SACCO
   members with legacy members by `memberId`, phone, and email. Do not mutate
   production data during reconciliation.
3. **Server-side bridge**: add authenticated SACCO endpoints that resolve the
   current SACCO user to exactly one legacy member, then delegate to existing
   wallet/cycle read and payment services. The bridge must enforce member scope
   and preserve admin role checks.
4. **Member read-only module**: add Wallet and Cycles entries to the SACCO
   member navigation and render the existing data inside the SACCO layout.
   Use a dialog/sheet for the cycle summary on mobile, with a full detail view
   only if the existing cycle workflow requires it.
5. **Payment actions**: wire deposit, withdrawal, and cycle contribution
   buttons only after the bridge has passed member-scope and callback tests.
6. **Admin consolidation**: extend the existing SACCO dashboard/member detail
   with wallet and cycle summaries, then add operations incrementally. Do not
   remove the legacy admin surface until parity is demonstrated.
7. **Decommission gate**: retain both APIs and the legacy UI until the test
   checklist passes for authentication, member isolation, payment callbacks,
   duplicate prevention, and all existing SACCO workflows.

## Current Safe First Slice

The smallest safe implementation slice is the identity reconciliation and
read-only server bridge. Adding navigation or copied wallet/cycle screens
before that bridge would either show data for the wrong member or require a
second login, violating the integration requirements.

## Validation Checklist

- SACCO member token cannot access another member's wallet, cycles, or
  transactions.
- Admin roles retain their existing permissions.
- Existing SACCO savings, loans, statements, and transactions are unchanged.
- Existing legacy wallet and cycle APIs continue to operate independently.
- Payment initiation, callback verification, failed payments, and duplicate
  prevention remain covered by tests.
- Production data is backed up and recoverable before deployment.