import { Injectable } from "@nestjs/common";
import {
  KnowledgeLoaderService,
  KnowledgeRecord,
} from "./knowledge-loader.service";

export interface RetrievedKnowledge {
  record: KnowledgeRecord;
  score: number;
  text: string;
}

@Injectable()
export class KnowledgeRetrievalService {
  private readonly stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "what",
    "when",
    "where",
    "which",
    "who",
    "whom",
    "whose",
    "why",
    "how",
    "are",
    "was",
    "were",
    "is",
    "am",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "can",
    "could",
    "will",
    "would",
    "should",
    "may",
    "might",
    "must",
    "shall",
    "not",
    "but",
    "from",
    "into",
    "onto",
    "upon",
    "than",
    "then",
    "there",
    "their",
    "them",
    "they",
    "your",
    "you",
    "our",
    "out",
    "about",
    "after",
    "before",
    "between",
    "over",
    "under",
    "again",
    "also",
    "some",
    "such",
    "its",
    "more",
    "most",
    "una",
    "hiyo",
    "hiki",
    "hivyo",
    "ambayo",
    "katika",
    "kwa",
    "zaidi",
    "au",
    "je",
    "ni",
    "ya",
    "wa",
    "na",
    "za",
    "the",
    "does",
    "say",
    "about",
    "what",
    "is",
    "are",
  ]);

  private readonly conceptTerms: Array<{ pattern: RegExp; tokens: string[] }> =
    [
      {
        pattern: /ukeketaji|female genital mutilation|\bfgm\b|genital cutting/i,
        tokens: [
          "ukeketaji",
          "fgm",
          "genital",
          "mutilation",
          "girl",
          "mtoto",
          "child",
        ],
      },
      {
        pattern:
          /\b(cut|cutting|mutilat\w*)\b.{0,45}\b(sister|daughter|girl|relative|mtoto)\b|\b(relative|sister|daughter)\b.{0,45}\b(cut|cutting|mutilat\w*)\b/i,
        tokens: [
          "ukeketaji",
          "fgm",
          "genital",
          "mutilation",
          "girl",
          "msichana",
          "mtoto",
          "child",
          "harm",
          "protection",
        ],
      },
      {
        pattern:
          /ndoa.{0,16}(utotoni|mtoto)|child marriage|married.{0,10}child/i,
        tokens: [
          "ndoa",
          "utotoni",
          "marriage",
          "child",
          "mtoto",
          "age",
          "umri",
        ],
      },
      {
        pattern:
          /family.{0,60}(pressur\w*|force).{0,40}marry|marry.{0,30}(before|under).{0,12}18|lazimish\w*.{0,30}kuolewa/i,
        tokens: [
          "ndoa",
          "utotoni",
          "marriage",
          "marry",
          "child",
          "mtoto",
          "girl",
          "msichana",
          "age",
          "umri",
          "legal",
          "sheria",
        ],
      },
      {
        pattern:
          /\b(kupiga|kupigwa|anampiga|kumpiga)\b|hit(ting)? a child|corporal punishment/i,
        tokens: [
          "kupiga",
          "child",
          "mtoto",
          "punishment",
          "correction",
          "harm",
          "violence",
        ],
      },
      {
        pattern: /elimu|shule|kusoma|school|education|study|kujielimisha/i,
        tokens: [
          "elimu",
          "shule",
          "kusoma",
          "education",
          "school",
          "child",
          "mtoto",
          "rights",
          "haki",
        ],
      },
      {
        pattern:
          /ukatili|unyanyas|abuse|violence|harm|hatar|salama|protection|kulind/i,
        tokens: [
          "violence",
          "abuse",
          "protection",
          "child",
          "mtoto",
          "safety",
          "usalama",
          "rights",
          "haki",
        ],
      },
      {
        pattern:
          /katiba|constitution|haki za msingi|fundamental rights|usawa|equality/i,
        tokens: [
          "katiba",
          "constitution",
          "rights",
          "haki",
          "equality",
          "usawa",
          "human",
          "binadamu",
        ],
      },
    ];

  constructor(private readonly loader: KnowledgeLoaderService) {}

  search(
    question: string,
    language: "sw" | "en",
    limit = 4,
  ): RetrievedKnowledge[] {
    const queryTokens = [
      ...new Set([
        ...this.tokenize(question),
        ...this.conceptTerms
          .filter((item) => item.pattern.test(question))
          .flatMap((item) => item.tokens),
      ]),
    ];
    if (!queryTokens.length) return [];

    return this.loader
      .getAll()
      .map((record) => {
        const text = this.getText(record, language);
        const searchable = this.tokenize(
          [
            record.title || "",
            record.topic || "",
            Array.isArray(record.keywords) ? record.keywords.join(" ") : "",
            typeof record["question_sw"] === "string"
              ? record["question_sw"]
              : "",
            typeof record["question_en"] === "string"
              ? record["question_en"]
              : "",
            text,
            record.scope || "",
          ].join(" "),
        );
        const unique = new Set(searchable);
        let matches = 0;
        for (const token of queryTokens) {
          if (unique.has(token)) matches += 1;
        }
        const coverage = matches / Math.max(queryTokens.length, 1);
        const density = matches / Math.max(Math.sqrt(unique.size), 1);
        let score = coverage * 0.75 + density * 0.25;
        if (record.type === "legal_evidence") score *= 1.3;
        if (record.type === "example_qa") score *= 1.15;
        if (record.source_type === "constitution" && record.verified !== true)
          score *= 0.35;
        if (record.verified === true) score *= 1.15;
        return { record, score, text };
      })
      .filter((item) => item.score >= 0.06)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private getText(record: KnowledgeRecord, language: "sw" | "en"): string {
    if (language === "en" && typeof record["english_equivalent"] === "string") {
      return record["english_equivalent"];
    }
    if (typeof record.content === "string") return record.content;
    if (record.content && typeof record.content === "object") {
      const content = record.content as { sw?: string; en?: string };
      const selected = content[language] || content.en || content.sw;
      if (typeof selected === "string") return selected;
    }
    const fallback = record[language] || record["content_text"];
    return typeof fallback === "string" ? fallback : "";
  }

  private tokenize(value: string): string[] {
    return value
      .toLocaleLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2 && !this.stopWords.has(token));
  }
}
