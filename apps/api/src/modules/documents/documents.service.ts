import { Injectable, BadRequestException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseService } from '../../common/database.service';
import { ConfigService } from '../../common/config.service';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/dicom',
  'application/dicom',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);
const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

@Injectable()
export class DocumentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService
  ) {}

  private root(): string {
    return this.config.storage.localRoot || path.join(process.cwd(), '.ficms-data', 'documents');
  }

  async store(file: { originalname: string; mimetype: string; buffer: Buffer; size: number }, input: { patientId?: string | null; refType?: string; refId?: string | null; uploadedById?: string | null }) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(`File type "${file.mimetype}" is not allowed.`);
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException('File exceeds the 25 MB limit.');
    }
    const ext = path.extname(file.originalname).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, '');
    const key = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}${ext}`;
    const abs = path.join(this.root(), key);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, file.buffer);
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const id = await this.db.repos.documents.create({
      patientId: input.patientId,
      refType: input.refType,
      refId: input.refId,
      name: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storageKey: key,
      sha256,
      uploadedById: input.uploadedById
    });
    return { id, name: file.originalname, sha256 };
  }

  async list(patientId: string) {
    return this.db.repos.documents.listForPatient(patientId);
  }

  async read(id: string): Promise<{ doc: Record<string, unknown>; data: Buffer }> {
    const doc = await this.db.repos.documents.findById(id);
    if (!doc) throw new BadRequestException('Document not found.');
    const abs = path.join(this.root(), String(doc.storage_key));
    const data = await fs.readFile(abs);
    return { doc, data };
  }
}
