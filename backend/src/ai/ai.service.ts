import { Injectable } from '@nestjs/common';
import { AnswerGenerationService } from './answer-generation.service';
import { KnowledgeLoaderService } from './knowledge/knowledge-loader.service';
import { KnowledgeRetrievalService } from './knowledge/knowledge-retrieval.service';

type Language = 'sw' | 'en';

@Injectable()
export class AiService {
  constructor(
    private readonly loader: KnowledgeLoaderService,
    private readonly retrieval: KnowledgeRetrievalService,
    private readonly generation: AnswerGenerationService,
  ) {}

  health() {
    const records = this.loader.count();
    return {
      status: records > 0 ? 'ok' : 'unavailable',
      service: 'SalamaLine AI',
      knowledgeBase: { loaded: records > 0, records },
      answerGeneration: {
        mode: process.env.AI_LLM_API_URL && process.env.AI_LLM_API_KEY && process.env.AI_LLM_MODEL
          ? 'configured_provider_with_grounded_fallback'
          : 'grounded_fallback',
      },
    };
  }

  async ask(question: string, requestedLanguage?: Language) {
    const language = requestedLanguage || this.detectLanguage(question);
    const safety = this.assessSafety(question);
    // A wider candidate set lets the answer layer combine legal, constitutional,
    // WHO, Q&A and safeguarding evidence rather than returning one best hit.
    const retrieved = this.retrieval.search(question, language, 18);
    const generated = await this.generation.generate(
      question,
      language,
      retrieved,
      this.loader.getSafetyRules(),
    );
    const answer = [generated.directAnswer, generated.explanation, generated.guidance]
      .filter((part) => typeof part === 'string' && part.trim())
      .join('\n\n');

    return {
      answer,
      directAnswer: generated.directAnswer,
      explanation: generated.explanation,
      guidance: generated.guidance,
      legalReferences: generated.legalReferences,
      language,
      sources: generated.sources,
      status: generated.status,
      generatedBy: generated.generatedBy,
      safety: {
        escalate: safety.escalate,
        reason: safety.reason,
        humanSupportRecommended: safety.escalate || generated.status === 'safety_guidance',
      },
    };
  }

  private detectLanguage(question: string): Language {
    const swWords = /\b(nina|nini|vipi|je|msaada|mtoto|ukatili|sheria|nawezaje|tafadhali|wapi|yangu|kwangu|ukeketaji|haki|elimu|ndoa|katiba)\b/i;
    return swWords.test(question) ? 'sw' : 'en';
  }

  private assessSafety(question: string) {
    const text = question.toLocaleLowerCase();
    const urgentPatterns = [
      /\b(niko|upo|yuko)\s+(kwenye\s+)?hatari\b/,
      /\b(anani|wanani)?tishia\b/,
      /\b(amenipiga|ananipiga|anapiga)\b/,
      /\b(i am|someone is|they are)\s+(in\s+)?immediate danger\b/,
      /\b(being|is)\s+(hurt|attacked|threatened)\b/,
      /\b(right now|immediate danger|in danger now)\b/,
      /\bsexual assault happening now\b/,
    ];
    const escalate = urgentPatterns.some((pattern) => pattern.test(text));
    return {
      escalate,
      reason: escalate ? 'possible_immediate_safety_risk' : 'standard',
    };
  }
}
