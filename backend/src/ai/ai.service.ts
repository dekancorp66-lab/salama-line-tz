import { Injectable } from "@nestjs/common";
import {
  AnswerGenerationService,
  GeneratedAnswer,
} from "./answer-generation.service";
import { KnowledgeLoaderService } from "./knowledge/knowledge-loader.service";
import { KnowledgeRetrievalService } from "./knowledge/knowledge-retrieval.service";
import { AiScopePolicyService } from "./ai-scope-policy.service";

type Language = "sw" | "en";

@Injectable()
export class AiService {
  constructor(
    private readonly loader: KnowledgeLoaderService,
    private readonly retrieval: KnowledgeRetrievalService,
    private readonly generation: AnswerGenerationService,
    private readonly scopePolicy: AiScopePolicyService,
  ) {}

  health() {
    const records = this.loader.count();
    return {
      status: records > 0 ? "ok" : "unavailable",
      service: "SalamaLine AI",
      knowledgeBase: { loaded: records > 0, records },
      answerGeneration: {
        mode: this.generation.providerMode(),
      },
    };
  }

  async ask(question: string, requestedLanguage?: Language) {
    question = this.redact(question);
    const language = requestedLanguage || this.detectLanguage(question);
    const safety = this.assessSafety(question);
    // A wider candidate set lets the answer layer combine legal, constitutional,
    // WHO, Q&A and safeguarding evidence rather than returning one best hit.
    const retrieved = this.retrieval.search(question, language, 18);
    const scope = this.scopePolicy.classify(question, retrieved);
    if (scope !== "relevant" && !safety.escalate) {
      return this.scopeResponse(scope, language, safety);
    }
    const generated = await this.generation.generate(
      question,
      language,
      retrieved,
      this.loader.getSafetyRules(),
    );
    const answer = [
      generated.directAnswer,
      generated.explanation,
      generated.guidance,
    ]
      .filter((part) => typeof part === "string" && part.trim())
      .join("\n\n");

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
        humanSupportRecommended:
          safety.escalate || generated.status === "safety_guidance",
      },
    };
  }

  private scopeResponse(
    scope: "greeting" | "thanks" | "identity" | "clarify" | "out_of_scope",
    language: Language,
    safety: ReturnType<AiService["assessSafety"]>,
  ): Pick<
    GeneratedAnswer,
    | "directAnswer"
    | "explanation"
    | "guidance"
    | "legalReferences"
    | "sources"
    | "status"
    | "generatedBy"
  > & {
    answer: string;
    language: Language;
    safety: {
      escalate: boolean;
      reason: string;
      humanSupportRecommended: boolean;
    };
  } {
    const directAnswer = {
      greeting:
        language === "sw"
          ? "Habari! Naweza kusaidia kuhusu haki za watoto na wanawake, afya, elimu, sheria za Tanzania na usalama."
          : "Hello! I can help with children’s and women’s rights, health, education, Tanzanian law, and safety.",
      thanks:
        language === "sw"
          ? "Karibu. Nipo hapa kusaidia."
          : "You’re welcome. I’m here to help.",
      identity:
        language === "sw"
          ? "Mimi ni Msaidizi wa SalamaLine. Naweza kueleza kwa lugha rahisi kuhusu haki za watoto na wanawake, usalama na ulinzi, afya, elimu, pamoja na sheria na sera za Tanzania. Jibu langu si mbadala wa mtaalamu; huhitaji kushiriki jina au taarifa binafsi. Una swali gani?"
          : "I’m SalamaLine’s assistant. I can explain children’s and women’s rights, safety and protection, health, education, and Tanzanian laws and policies in plain language. I’m not a substitute for a trained professional, and you don’t need to share identifying details. What would you like help with?",
      clarify:
        language === "sw"
          ? "Naweza kusaidia. Tafadhali taja kidogo mada unayorejelea—kwa mfano haki, afya, elimu au usalama."
          : "I can help. Please briefly restate the topic you mean, such as rights, health, education, or safety.",
      out_of_scope:
        language === "sw"
          ? "SalamaLine inalenga haki za watoto na wanawake, afya, elimu, sheria na sera za Tanzania, pamoja na usalama na huduma za msaada zilizothibitishwa. Siwezi kusaidia ombi lisilohusiana na mada hizo."
          : "SalamaLine focuses on children’s and women’s rights, health, education, Tanzanian laws and policies, and safeguarding or verified support services. I can’t help with requests unrelated to those topics.",
    }[scope];
    const answered =
      scope === "greeting" || scope === "thanks" || scope === "identity";
    return {
      answer: directAnswer,
      directAnswer,
      explanation: "",
      guidance: undefined,
      legalReferences: [],
      language,
      sources: [],
      status: answered ? "answered" : "no_reliable_answer",
      generatedBy: "grounded_fallback",
      safety: {
        escalate: safety.escalate,
        reason: safety.reason,
        humanSupportRecommended: safety.escalate,
      },
    };
  }

  private redact(question: string): string {
    return question
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
      .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[redacted]")
      .replace(
        /\b(my name is|jina langu ni|ninaitwa)\s+[\p{L}'-]+(?:\s+[\p{L}'-]+){0,2}/giu,
        "$1 [redacted]",
      )
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .slice(0, 1200);
  }

  private detectLanguage(question: string): Language {
    const swWords =
      /\b(nina|nini|vipi|je|msaada|mtoto|ukatili|sheria|nawezaje|tafadhali|wapi|yangu|kwangu|ukeketaji|haki|elimu|ndoa|katiba|asante|shukrani|unaitwa|jitambulishe|wewe|jina|nani)\b/i;
    return swWords.test(question) ||
      /^\s*(habari|hujambo|mambo)\b/i.test(question)
      ? "sw"
      : "en";
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
      reason: escalate ? "possible_immediate_safety_risk" : "standard",
    };
  }
}
