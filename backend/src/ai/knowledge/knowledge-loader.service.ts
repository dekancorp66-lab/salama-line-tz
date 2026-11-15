import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface KnowledgeRecord {
  id: string;
  type?: string;
  topic?: string;
  language?: 'sw' | 'en' | string;
  title?: string;
  content?: { sw?: string; en?: string } | string;
  keywords?: string[];
  source_ids?: string[];
  source_id?: string;
  source_title?: string;
  source_url?: string;
  additional_source_url?: string;
  citation?: string;
  page_number?: number;
  verified?: boolean;
  scope?: string;
  evidence_status?: string;
  [key: string]: unknown;
}

@Injectable()
export class KnowledgeLoaderService implements OnModuleInit {
  private readonly logger = new Logger(KnowledgeLoaderService.name);
  private records: KnowledgeRecord[] = [];
  private qaRecords: KnowledgeRecord[] = [];
  private constitutionRecords: KnowledgeRecord[] = [];
  private safetyRules: Array<{ id: string; rule: string; action: string; severity: string }> = [];

  onModuleInit(): void {
    this.load();
  }

  load(): void {
    const files = {
      knowledge: this.loadJsonLines('salamaline_knowledge.jsonl'),
      legal: this.loadJsonLines('verified_legal_records.jsonl'),
      constitution: this.loadJsonLines('constitution_pages.jsonl', 'constitution-tz'),
      qa: this.loadJsonLines('salamaline_qa.jsonl'),
      safety: this.loadJsonLines('salamaline_safety.jsonl'),
    };
    this.records = [...files.knowledge, ...files.legal];
    this.constitutionRecords = files.constitution;
    this.qaRecords = files.qa.map((record) => ({
      ...record,
      type: 'example_qa',
      content: {
        sw: typeof record['answer_sw'] === 'string' ? record['answer_sw'] : undefined,
        en: typeof record['answer_en'] === 'string' ? record['answer_en'] : undefined,
      },
      keywords: [record['question_sw'], record['question_en'], record.topic]
        .filter((value): value is string => typeof value === 'string'),
    }));
    this.safetyRules = files.safety.filter((record) =>
      typeof record.id === 'string' && typeof record.rule === 'string' && typeof record.action === 'string',
    ) as typeof this.safetyRules;

    if (!files.knowledge.length) {
      this.logger.warn('Primary knowledge file not found or contained no valid records. AI retrieval will use any other loaded evidence and safe fallback rules.');
    }
    if (!files.legal.length) this.logger.warn('Verified legal evidence file not found; legal answers will be limited to available summaries.');
    if (!files.constitution.length) this.logger.warn('Constitution page file not found; constitutional questions may receive a safe no-data response.');
    this.logger.log(`Loaded ${this.count()} searchable evidence records and ${this.safetyRules.length} safeguarding rules.`);
  }

  private loadJsonLines(fileName: string, subdirectory?: string): KnowledgeRecord[] {
    const configured = process.env.SALAMALINE_KNOWLEDGE_DIR;
    const directories = [
      ...(configured ? [resolve(process.cwd(), configured)] : []),
      resolve(process.cwd(), 'knowledge-base'),
      resolve(process.cwd(), 'backend/knowledge-base'),
      // Nest copies assets to the build output root in production.
      resolve(__dirname, '../../../'),
      resolve(__dirname, '../../../knowledge-base'),
    ];
    const candidates = directories.flatMap((directory) => [
      ...(subdirectory ? [join(directory, subdirectory, fileName)] : []),
      join(directory, fileName),
    ]);
    const filePath = candidates.find((candidate) => existsSync(candidate));
    if (!filePath) return [];

    let raw: string;
    try {
      raw = readFileSync(filePath, 'utf8');
    } catch {
      this.logger.warn(`Knowledge asset ${fileName} could not be read.`);
      return [];
    }
    const parsed: KnowledgeRecord[] = [];
    raw.split(/\r?\n/).forEach((line, index) => {
      if (!line.trim()) return;
      try {
        const record = JSON.parse(line) as KnowledgeRecord;
        if (record && typeof record.id === 'string' && record.id.trim()) {
          parsed.push(record);
        } else if (record && typeof record.page_number === 'number' && record.source_type === 'constitution') {
          parsed.push({ ...record, id: `CON_PAGE_${record.page_number}` });
        } else {
          this.logger.warn(`Skipping ${fileName} line ${index + 1}: missing stable record id`);
        }
      } catch {
        this.logger.warn(`Skipping invalid ${fileName} line ${index + 1}`);
      }
    });
    return parsed;
  }

  getAll(): KnowledgeRecord[] {
    return [...this.records, ...this.qaRecords, ...this.constitutionRecords];
  }

  getSafetyRules() {
    return [...this.safetyRules];
  }

  count(): number {
    return this.records.length + this.qaRecords.length + this.constitutionRecords.length;
  }
}
