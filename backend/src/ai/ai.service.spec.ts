import { AiService } from './ai.service';
import { KnowledgeLoaderService } from './knowledge/knowledge-loader.service';
import { KnowledgeRetrievalService } from './knowledge/knowledge-retrieval.service';

describe('AiService', () => {
  let service: AiService;

  beforeEach(() => {
    const loader = new KnowledgeLoaderService();
    loader.load();
    service = new AiService(loader, new KnowledgeRetrievalService(loader));
  });

  it('reports the number of actually loaded knowledge records', () => {
    expect(service.health()).toEqual({
      status: 'ok',
      service: 'SalamaLine AI',
      knowledgeBase: { loaded: true, records: 25 },
    });
  });

  it('retrieves Kiswahili knowledge with source references', () => {
    const result = service.ask('Ninawezaje kupata msaada?', 'sw');
    expect(result.status).toBe('answered');
    expect(result.language).toBe('sw');
    expect(result.answer).toContain('Msaada unapaswa');
    expect(result.sources).toContainEqual(expect.objectContaining({ id: 'WHO_TRAINING_2021' }));
  });

  it('retrieves the English equivalent for English questions', () => {
    const result = service.ask('How can I get support?', 'en');
    expect(result.status).toBe('answered');
    expect(result.language).toBe('en');
    expect(result.answer).toContain('Support should centre the survivor');
  });

  it('returns a safe fallback without inventing sources when retrieval is insufficient', () => {
    const result = service.ask('What is the weather on Mars?', 'en');
    expect(result.status).toBe('no_reliable_answer');
    expect(result.sources).toEqual([]);
    expect(result.answer).toContain('not have enough verified information');
  });
});
