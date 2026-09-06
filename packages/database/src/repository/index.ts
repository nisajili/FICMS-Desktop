import type { SqlEngine } from '../engine/types';
import { UserRepository, RoleRepository, SessionRepository, rolePermissions } from './users';

export { rolePermissions };
import { SettingsRepository, BranchRepository, DepartmentRepository, ServiceCatalogRepository, TestCatalogRepository, MedicationCatalogRepository, TemplateRepository } from './org';
import { PatientRepository, AppointmentRepository, ReferralRepository } from './patients';
import { ClinicalRepository, ConsultationRepository, AlertRepository, DiagnosisRepository, PrescriptionRepository, InvestigationRepository } from './clinical';
import { CycleRepository } from './cycles';
import { SemenRepository, LabResultRepository, QcRepository, AccessionRepository } from './lab';
import { CryoRepository } from './cryo';
import { FinanceRepository } from './finance';
import { InventoryRepository } from './inventory';
import { AuditRepository } from './audit';
import { SyncRepository } from './sync';
import { DocumentRepository } from './documents';
import { CounselingRepository, DonorRepository, HrRepository } from './hr';
import { ImagingRepository, NursingRepository } from './clinical-support';

/**
 * Aggregate of all repositories, bound to a single SQL engine (or a
 * transaction-scoped engine). Services receive a `Repositories` instance and
 * call methods without knowing which engine is in use.
 */
export class Repositories {
  readonly users: UserRepository;
  readonly roles: RoleRepository;
  readonly sessions: SessionRepository;
  readonly settings: SettingsRepository;
  readonly branches: BranchRepository;
  readonly departments: DepartmentRepository;
  readonly services: ServiceCatalogRepository;
  readonly tests: TestCatalogRepository;
  readonly medications: MedicationCatalogRepository;
  readonly formTemplates: TemplateRepository;
  readonly consentTemplates: TemplateRepository;
  readonly patients: PatientRepository;
  readonly appointments: AppointmentRepository;
  readonly referrals: ReferralRepository;
  readonly clinical: ClinicalRepository;
  readonly consultations: ConsultationRepository;
  readonly alerts: AlertRepository;
  readonly diagnoses: DiagnosisRepository;
  readonly prescriptions: PrescriptionRepository;
  readonly investigations: InvestigationRepository;
  readonly cycles: CycleRepository;
  readonly semen: SemenRepository;
  readonly labResults: LabResultRepository;
  readonly qc: QcRepository;
  readonly accessions: AccessionRepository;
  readonly cryo: CryoRepository;
  readonly finance: FinanceRepository;
  readonly inventory: InventoryRepository;
  readonly audit: AuditRepository;
  readonly sync: SyncRepository;
  readonly documents: DocumentRepository;
  readonly counseling: CounselingRepository;
  readonly donors: DonorRepository;
  readonly hr: HrRepository;
  readonly imaging: ImagingRepository;
  readonly nursing: NursingRepository;

  constructor(readonly db: SqlEngine) {
    this.users = new UserRepository(db);
    this.roles = new RoleRepository(db);
    this.sessions = new SessionRepository(db);
    this.settings = new SettingsRepository(db);
    this.branches = new BranchRepository(db);
    this.departments = new DepartmentRepository(db);
    this.services = new ServiceCatalogRepository(db);
    this.tests = new TestCatalogRepository(db);
    this.medications = new MedicationCatalogRepository(db);
    this.formTemplates = new TemplateRepository(db, 'form_templates');
    this.consentTemplates = new TemplateRepository(db, 'consent_templates');
    this.patients = new PatientRepository(db);
    this.appointments = new AppointmentRepository(db);
    this.referrals = new ReferralRepository(db);
    this.clinical = new ClinicalRepository(db);
    this.consultations = new ConsultationRepository(db);
    this.alerts = new AlertRepository(db);
    this.diagnoses = new DiagnosisRepository(db);
    this.prescriptions = new PrescriptionRepository(db);
    this.investigations = new InvestigationRepository(db);
    this.cycles = new CycleRepository(db);
    this.semen = new SemenRepository(db);
    this.labResults = new LabResultRepository(db);
    this.qc = new QcRepository(db);
    this.accessions = new AccessionRepository(db);
    this.cryo = new CryoRepository(db);
    this.finance = new FinanceRepository(db);
    this.inventory = new InventoryRepository(db);
    this.audit = new AuditRepository(db);
    this.sync = new SyncRepository(db);
    this.documents = new DocumentRepository(db);
    this.counseling = new CounselingRepository(db);
    this.donors = new DonorRepository(db);
    this.hr = new HrRepository(db);
    this.imaging = new ImagingRepository(db);
    this.nursing = new NursingRepository(db);
  }
}
