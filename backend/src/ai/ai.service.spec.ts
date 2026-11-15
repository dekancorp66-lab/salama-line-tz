import { AiService } from './ai.service';
import { AnswerGenerationService } from './answer-generation.service';
import { KnowledgeLoaderService } from './knowledge/knowledge-loader.service';
import { KnowledgeRetrievalService } from './knowledge/knowledge-retrieval.service';

describe('SalamaLine AI grounded answers', () => {
  let service: AiService;

  beforeEach(() => {
    delete process.env.AI_LLM_API_URL;
    delete process.env.AI_LLM_API_KEY;
    delete process.env.AI_LLM_MODEL;
    const loader = new KnowledgeLoaderService();
    loader.load();
    service = new AiService(loader, new KnowledgeRetrievalService(loader), new AnswerGenerationService());
  });

  it('loads the original summaries, bilingual Q&A, Constitution pages, legal evidence and safeguarding rules', () => {
    const health = service.health();
    expect(health.status).toBe('ok');
    expect(health.knowledgeBase.records).toBeGreaterThan(250);
    expect(health.answerGeneration.mode).toBe('grounded_fallback');
  });

  it('answers the exact FGM question naturally and keeps verified sources below the answer', async () => {
    const result = await service.ask('Je, ukeketaji ni sahihi kwa mtoto wa kike?', 'sw');
    expect(result.directAnswer).toMatch(/^Hapana\./);
    expect(result.explanation).toMatch(/hauna faida.{0,30}kiafya|madhara|kudhuru/i);
    expect(result.explanation).not.toMatch(/kifungu|ibara|section|article/i);
    expect(result.legalReferences).toContainEqual(expect.objectContaining({ reference: 'Section 160(1)–(2)', verified: true }));
    expect(result.legalReferences).not.toContainEqual(expect.objectContaining({ source: expect.stringContaining('Constitution') }));
    expect(result.sources.some((source) => source.id === 'WHO_FGM_2025')).toBe(true);
    expect(result.legalReferences.some((reference) => reference.source.includes('WHO'))).toBe(false);
    expect(result.generatedBy).toBe('grounded_fallback');
  });

  it('answers why FGM is harmful from WHO evidence', async () => {
    const result = await service.ask('Kwa nini ukeketaji ni hatari kwa mtoto?', 'sw');
    expect(`${result.directAnswer} ${result.explanation}`).toMatch(/hakuna faida.{0,30}kiafya|hauna faida.{0,30}kiafya/i);
    expect(`${result.directAnswer} ${result.explanation}`).toMatch(/madhara|kuathiri|kudhuru/i);
    expect(result.directAnswer).toMatch(/^Hapana\./);
    expect(result.sources.some((source) => source.id === 'WHO_FGM_2025')).toBe(true);
  });

  it('explains child protection using the Act and safeguarding language', async () => {
    const result = await service.ask('Je, mtoto ana haki ya kulindwa dhidi ya ukatili?', 'sw');
    expect(result.directAnswer).toMatch(/^Ndiyo\./);
    expect(result.explanation).toContain('afya, usalama na ukuaji');
    expect(result.legalReferences).toContainEqual(expect.objectContaining({ reference: 'Section 9(3)(a)' }));
  });

  it('answers the child marriage question while disclosing conflicting legal texts', async () => {
    const result = await service.ask('Je, ndoa ya utotoni ni sahihi?', 'sw');
    expect(result.directAnswer).toContain('miaka 18 kwa wote');
    expect(result.explanation).toContain('hali ya kisheria ina utata');
    expect(result.explanation).toContain('bado yana vifungu vinavyoonyesha umri tofauti');
    expect(result.legalReferences.some((reference) => reference.reference.includes('section 13'))).toBe(true);
  });

  it('explains the legal limits around correction and punishment without claiming every act of hitting is criminal', async () => {
    const result = await service.ask('Je, kumpiga mtoto ni sahihi?', 'sw');
    expect(result.directAnswer).toContain('mtoto hastahili kuumizwa');
    expect(result.explanation).toContain('bila ukatili au udhalilishaji');
    expect(result.explanation).not.toMatch(/kifungu|section/i);
  });

  it('answers Constitution equality questions with verified provisions', async () => {
    const result = await service.ask('Katiba inasemaje kuhusu usawa wa binadamu?', 'sw');
    expect(result.directAnswer).toContain('binadamu wote huzaliwa huru na sawa');
    expect(result.explanation.toLocaleLowerCase()).toContain('heshima');
    expect(result.legalReferences.some((reference) => reference.reference.startsWith('Article 12(1)–(2)'))).toBe(true);
  });

  it('answers Constitution fundamental rights questions in English', async () => {
    const result = await service.ask('What does the Constitution say about fundamental rights?', 'en');
    expect(result.language).toBe('en');
    expect(result.directAnswer).toContain('basic rights');
    expect(result.legalReferences.some((reference) => reference.reference.includes('Article 12'))).toBe(true);
  });

  it('explains the Law of the Child Act protection in English', async () => {
    const result = await service.ask('What protection does Tanzanian law provide to children?', 'en');
    expect(result.directAnswer).toContain('right to protection');
    expect(result.explanation).toContain('health, safety and development');
  });

  it('gives safe human-support options without pressure or invented contacts for a child in danger', async () => {
    const result = await service.ask('Ninawezaje kupata msaada ikiwa mtoto yuko kwenye hatari?', 'sw');
    expect(result.status).toBe('safety_guidance');
    expect(result.guidance).toContain('mtu mzima');
    expect(result.guidance).not.toMatch(/\+?\d{3,}/);
    expect(result.guidance).toContain('usimkabili');
  });

  it('returns a safe no-evidence answer to unrelated questions without inventing sources', async () => {
    const result = await service.ask('What is the weather on Mars?', 'en');
    expect(result.status).toBe('no_reliable_answer');
    expect(result.sources).toEqual([]);
    expect(result.legalReferences).toEqual([]);
    expect(result.directAnswer).toContain('not have enough evidence');
  });

  it('answers 15 representative chat questions in a natural, source-grounded style', async () => {
    const prompts: Array<[string, 'sw' | 'en']> = [
      ['Je, ukeketaji ni sawa kwa mtoto wa kike?', 'sw'],
      ['Kwa nini ukeketaji ni hatari kwa mtoto?', 'sw'],
      ['Je, mtoto wa kike anaruhusiwa kwenda shule?', 'sw'],
      ['Mtoto ana haki gani ya kupata elimu?', 'sw'],
      ['Mtoto wa kike anaweza kuolewa akiwa na umri gani?', 'sw'],
      ['Je, ndoa ya utotoni ni sahihi?', 'sw'],
      ['Je, ni sawa kumpiga mtoto kama adhabu?', 'sw'],
      ['Je, watoto wana haki ya kulindwa dhidi ya ukatili?', 'sw'],
      ['Ninawezaje kupata msaada?', 'sw'],
      ['Katiba inasemaje kuhusu usawa?', 'sw'],
      ['What rights do children have to education?', 'en'],
      ['At what age can a girl get married in Tanzania?', 'en'],
      ['Can adults hit a child as punishment?', 'en'],
      ['How can I support a child who feels unsafe?', 'en'],
      ['What is the weather on Mars?', 'en'],
    ];

    for (const [question, language] of prompts) {
      const result = await service.ask(question, language);
      expect(result.language).toBe(language);
      expect(result.directAnswer.length).toBeGreaterThan(12);
      expect(result.directAnswer).not.toMatch(/^(katiba|constitution),?\s*(ibara|article)|^(kwa mujibu wa kifungu|section \d)/i);
      if (result.status === 'answered') expect(result.sources.length).toBeGreaterThan(0);
    }
  });
});
