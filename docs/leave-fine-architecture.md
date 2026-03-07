# Leave + Fine Architecture (Canonical)

## Canonical Leave Model
- Single table: `leaves`
- Linked to drill (`drill_id`) and cadet (`regimental_no`)
- Status lifecycle: `pending`, `approved`, `rejected`
- Constraint: unique per cadet per drill (`uq_leaves_regimental_drill`)

## Fine Ledger Model
- `fines`: one fine per cadet per drill (`uq_fines_regimental_drill`)
- `fine_events`: audit trail (`created`, `reversed`, `paid`, `adjusted`)
- `fine_payments`: payment submissions and verification

## Eligibility Engine
`FineEligibilityService` runs on:
- attendance patch (`/api/attendance/records`)
- leave apply/review (`/api/leave/*`, `/api/attendance/leave*`)

Rule:
- attendance `A` + no leave or `rejected` leave -> fine Rs. 15 pending
- attendance `P` OR leave `approved`/`pending` -> fine reversed/cancelled

Idempotency:
- unique DB constraints + state transition checks prevent duplicate fines/events.

## APIs
### Leave APIs
- `POST /api/leave/apply` (CADET) -> requires `drill_id`, `reason`
- `GET /api/leave/my` (CADET)
- `GET /api/leave/all` (SUO/ANO)
- `PATCH /api/leave/:id/status` (SUO/ANO)

### Fine APIs
- `GET /api/fines/my` (CADET)
- `GET /api/fines` (SUO/ANO)
- `POST /api/fines/:id/pay` (CADET)
- `PATCH /api/fines/:id/verify` (SUO/ANO)
- `GET /api/fines/report` (SUO/ANO, supports `format=csv`)

## Notifications
Rows inserted in `notifications` on:
- fine created
- fine reversed
- fine payment submitted/verified
