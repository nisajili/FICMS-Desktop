import type { SqlEngine } from '../engine/types';
import { newId, nowIso } from './base';

export class DocumentRepository {
  constructor(private readonly db: SqlEngine) {}

  async create(data: {
    patientId?: string | null;
    refType?: string;
    refId?: string | null;
    name: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    sha256?: string | null;
    uploadedById?: string | null;
  }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO file_documents (id, patient_id, ref_type, ref_id, name, mime_type, size_bytes, storage_key, sha256, uploaded_by_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.patientId ?? null, data.refType ?? 'GENERAL', data.refId ?? null, data.name, data.mimeType, data.sizeBytes, data.storageKey, data.sha256 ?? null, data.uploadedById ?? null, nowIso()]
    );
    return id;
  }

  async listForPatient(patientId: string): Promise<Record<string, unknown>[]> {
    return this.db.all(`SELECT * FROM file_documents WHERE patient_id = ? ORDER BY created_at DESC`, [patientId]);
  }

  async findById(id: string): Promise<Record<string, unknown> | undefined> {
    return this.db.get(`SELECT * FROM file_documents WHERE id = ?`, [id]);
  }
}
