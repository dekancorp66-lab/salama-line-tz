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
  scope?: string;
  evidence_status?: string;
  [key: string]: unknown;
}

@Injectable()
export class KnowledgeLoaderService implements OnModuleInit {
  private readonly logger = new Logger(KnowledgeLoaderService.name);
  private records: KnowledgeRecord[] = [];

  onModuleInit(): void {
    this.load();
  }

  load(): void {
    const configured = process.env.SALAMALINE_KNOWLEDGE_DIR;
    const directories = [
      ...(configured ? [resolve(process.cwd(), configured)] : []),
      resolve(process.cwd(), 'knowledge-base'),
      resolve(process.cwd(), 'backend/knowledge-base'),
      // Nest copies the JSONL asset to the build output root in production.
      resolve(__dirname, '../../../'),
      // Also support builds that preserve the knowledge-base directory.
      resolve(__dirname, '../../../knowledge-base'),
    ];
    const filePath = directories
      .map((directory) => join(directory, 'salamaline_knowledge.jsonl'))
      .find((candidate) => existsSync(candidate));

    if (!filePath) {
      this.records = [];
      this.logger.warn('Knowledge file not found. AI retrieval will return a safe no-data response.');
      return;
    }

    let raw: string;
    try {
      raw = readFileSync(filePath, 'utf8');
    } catch {
      this.records = [];
      this.logger.warn('Knowledge file could not be read. AI retrieval will return a safe no-data response.');
      return;
    }
    const parsed: KnowledgeRecord[] = [];
    const lines = raw.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (!line.trim()) return;
      try {
        const record = JSON.parse(line) as KnowledgeRecord;
        if (record && typeof record.id === 'string' && record.id.trim()) parsed.push(record);
        else this.logger.warn(`Skipping JSONL line ${index + 1}: missing string id`);
      } catch {
        this.logger.warn(`Skipping invalid JSONL line ${index + 1}`);
      }
    });

    this.records = parsed;
    if (!this.records.length) {
      this.logger.warn('Knowledge file contained no valid records. AI retrieval will return a safe no-data response.');
      return;
    }
    this.logger.log(`Loaded ${this.records.length} knowledge records.`);
  }

  getAll(): KnowledgeRecord[] {
    return [...this.records];
  }

  count(): number {
    return this.records.length;
  }
}
