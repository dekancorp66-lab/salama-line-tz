import { Injectable } from '@nestjs/common';
import { KnowledgeLoaderService, KnowledgeRecord } from './knowledge-loader.service';

export interface RetrievedKnowledge {
  record: KnowledgeRecord;
  score: number;
  text: string;
}

@Injectable()
export class KnowledgeRetrievalService {
  private readonly stopWords = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'what', 'when', 'where', 'which',
    'who', 'whom', 'whose', 'why', 'how', 'are', 'was', 'were', 'is', 'am', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'can', 'could',
    'will', 'would', 'should', 'may', 'might', 'must', 'shall', 'not', 'but',
    'from', 'into', 'onto', 'upon', 'than', 'then', 'there', 'their', 'them',
    'they', 'your', 'you', 'our', 'out', 'about', 'after', 'before', 'between',
    'over', 'under', 'again', 'also', 'some', 'such', 'its', 'more', 'most',
    'una', 'hiyo', 'hiki', 'hivyo', 'ambayo', 'katika', 'kwa', 'zaidi', 'au',
  ]);

  constructor(private readonly loader: KnowledgeLoaderService) {}

  search(question: string, language: 'sw' | 'en', limit = 4): RetrievedKnowledge[] {
    const queryTokens = this.tokenize(question);
    if (!queryTokens.length) return [];

    return this.loader.getAll()
      .map((record) => {
        const text = this.getText(record, language);
        const searchable = this.tokenize([
          record.title || '',
          record.topic || '',
          Array.isArray(record.keywords) ? record.keywords.join(' ') : '',
          text,
          record.scope || '',
        ].join(' '));
        const unique = new Set(searchable);
        let score = 0;
        for (const token of queryTokens) {
          if (unique.has(token)) score += 1;
        }
        const coverage = score / Math.max(queryTokens.length, 1);
        const density = score / Math.max(Math.sqrt(unique.size), 1);
        return { record, score: coverage * 0.75 + density * 0.25, text };
      })
      .filter((item) => item.score >= 0.08)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private getText(record: KnowledgeRecord, language: 'sw' | 'en'): string {
    if (language === 'en' && typeof record['english_equivalent'] === 'string') {
      return record['english_equivalent'];
    }
    if (typeof record.content === 'string') return record.content;
    if (record.content && typeof record.content === 'object') {
      const selected = record.content[language] || record.content.en || record.content.sw;
      if (typeof selected === 'string') return selected;
    }
    const fallback = record[language] || record['content_text'];
    return typeof fallback === 'string' ? fallback : '';
  }

  private tokenize(value: string): string[] {
    return value.toLocaleLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2 && !this.stopWords.has(token));
  }
}
