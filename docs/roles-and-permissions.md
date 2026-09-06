# Roles & permissions

FICMS uses resource-based, attribute-aware authorization. Every protected
endpoint checks a `resource:action` permission; permissions are granted through
roles, and roles are stored in the database so each clinic can tune them.

The shipped baseline lives in `packages/domain/src/permissions.ts`
(`ROLE_DEFINITIONS`) and is seeded into fresh installs. The `*` permission
grants everything (reserved for `SYSTEM_ADMINISTRATOR`).

## Action verbs

| Verb | Meaning |
|---|---|
| `view` | read a record |
| `create` | create a record |
| `update` | edit a non-signed record |
| `sign` | sign/approve a record as a responsible clinician |
| `verify` | second (witness) verification of an identity-sensitive event |
| `approve` | clinical/financial approval |
| `release` | release a result/sample out of the lab/cryobank |
| `correct` | append a correction (never silently overwrite) |
| `export` | export data out of the system |
| `print` | print a document/receipt |
| `archive` | archive a record |
| `cancel` | cancel an appointment/order |
| `refund` | issue a refund/credit note |
| `transfer` | move stock/samples between locations |
| `dispose` | destroy/dispose of samples |
| `administer` | HR-administer staff records |

## Roles

| Role | Purpose | Highlights |
|---|---|---|
| `SYSTEM_ADMINISTRATOR` | Full platform control | `*` |
| `CLINIC_OWNER` | Oversight, no routine clinical signing | all of patient/appointment/finance/report/inventory/cryobank; settings, users, audit, backup |
| `CLINIC_DIRECTOR` | Clinical + operational leadership | clinical record/consultation (clinical verbs), laboratory, reports; finance approve |
| `CLINIC_ADMINISTRATOR` | Day-to-day administration | patient/appointment/finance/inventory; settings, users, reports |
| `RECEPTIONIST` | Registration, scheduling, check-in | patient view/create/update; appointment; finance view/create/print |
| `FERTILITY_SPECIALIST` | Lead ART clinician | patient; consultation/record/plan/prescription/investigation; lab release; cryobank approve |
| `DOCTOR` | General clinician | consultation/record/prescription (sign); investigation; laboratory view |
| `EMBRYOLOGIST` | Embryology + double-witness | embryology (verify/sign/release); cryobank (verify/transfer) |
| `ANDROLOGIST` | Semen analysis & sperm prep | andrology (verify/sign/release); cryobank verify |
| `LABORATORY_SCIENTIST` | General lab & QC | laboratory (verify/sign); investigation |
| `SONOGRAPHER` | Ultrasound | imaging (verify); clinical_record view |
| `NURSE` | Nursing care, vitals, injections | nursing; prescription/investigation (update) |
| `PHARMACIST` | Pharmacy verification & dispensing | pharmacy (verify/sign); inventory transfer |
| `COUNSELOR` | Counseling (restricted notes) | counseling; patient view |
| `CASHIER` | Payments & shifts | finance (refund/print); billing view |
| `FINANCE_OFFICER` | Invoices, reconciliation, revenue | finance/report (all) |
| `INVENTORY_OFFICER` | Stock, purchase orders, suppliers | inventory (all) |
| `HUMAN_RESOURCES_OFFICER` | Staff, attendance, payroll | hr (administer); user view |
| `AUDITOR` | Read-only compliance | audit_log, clinical_record/lab/cryobank/finance/report/settings view |
| `PATIENT` | Patient portal (own records) | appointment; clinical_record/finance view |

## Permission summary by resource

The `all(resource)` helper expands to
`view, create, update, sign, verify, approve, release, correct, export, print,
archive, cancel, refund, transfer, dispose`; the `clinical(resource)` helper to
`view, create, update, sign, correct, print, archive`.

| Resource | Who holds it |
|---|---|
| `patient` | owner, director, admin, receptionist, specialist, doctor, … (most roles hold `view`) |
| `appointment` | owner, director, admin, receptionist, patient |
| `clinical_record` | director/specialist/doctor (clinical verbs); auditor/nurse/sono/patient view |
| `consultation` | director/specialist/doctor |
| `treatment_plan`, `prescription`, `investigation` | specialist, doctor (plus nurse/pharmacist update on prescription/investigation) |
| `laboratory` | owner, director, admin, embryologist, andrologist, lab scientist |
| `embryology` | embryologist |
| `andrology` | andrologist |
| `imaging` | specialist, sonographer |
| `nursing` | nurse |
| `pharmacy` | pharmacist, inventory officer (view) |
| `cryobank` | owner, specialist (approve), embryologist, andrologist |
| `finance` / `billing` | owner, director, admin, receptionist, cashier, finance officer |
| `inventory` | owner, admin, pharmacist, inventory officer |
| `report` | owner, director, admin, finance officer, auditor |
| `settings` | owner, admin (view/update); director/auditor view |
| `user` | owner, admin, HR officer |
| `audit_log` | owner, director, auditor |
| `backup` | owner |
| `hr` | HR officer |

## Extending the matrix

Roles are data, not code. Administrators can create additional roles, adjust
permissions, and assign roles to users through the admin workspace. New
protected endpoints should declare their required permission using the existing
guards (see `apps/api/src/modules/patients/patients.controller.ts` for the
pattern).
