const mockInteractionsCreate = jest.fn();

jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    interactions: { create: mockInteractionsCreate },
  })),
}));

import { AiScopePolicyService } from "./ai-scope-policy.service";
import { AiService } from "./ai.service";
import { AnswerGenerationService } from "./answer-generation.service";
import { KnowledgeLoaderService } from "./knowledge/knowledge-loader.service";
import { KnowledgeRetrievalService } from "./knowledge/knowledge-retrieval.service";

describe("Gemini provider integration", () => {
  let service: AiService;
  let retrieval: KnowledgeRetrievalService;

  beforeAll(() => {
    const loader = new KnowledgeLoaderService();
    loader.load();
    retrieval = new KnowledgeRetrievalService(loader);
    service = new AiService(
      loader,
      retrieval,
      new AnswerGenerationService(),
      new AiScopePolicyService(),
    );
  });

  beforeEach(() => {
    mockInteractionsCreate.mockReset();
    process.env.GEMINI_API_KEY = "test-only-key";
    process.env.GEMINI_MODEL = "test-model";
    process.env.GEMINI_ENABLED = "true";
    process.env.GEMINI_MINOR_SAFEGUARDS_CONFIRMED = "true";
    process.env.OPENAI_ENABLED = "false";
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    process.env.GEMINI_ENABLED = "false";
    process.env.GEMINI_MINOR_SAFEGUARDS_CONFIRMED = "false";
    process.env.OPENAI_ENABLED = "false";
  });

  it("uses Gemini Interactions with curated evidence, not the raw question", async () => {
    mockInteractionsCreate.mockResolvedValue({
      output_text: JSON.stringify({
        directAnswer: "Article 11 recognizes access to education.",
        explanation: "This is based on the verified Constitution record.",
      }),
    });

    const result = await service.ask(
      "Does the Constitution recognize a right to education? My name is Example Person.",
      "en",
    );

    expect(result.generatedBy).toBe("configured_llm");
    expect(mockInteractionsCreate).toHaveBeenCalledTimes(1);
    const request = mockInteractionsCreate.mock.calls[0][0];
    expect(request.model).toBe("test-model");
    expect(request.store).toBe(false);
    expect(request.input).toContain("constitution_article_11");
    expect(request.input).not.toContain("Example Person");
    expect(request.input).not.toContain("Does the Constitution recognize");
  });

  it("keeps urgent and sensitive disclosures local despite Gemini opt-in", async () => {
    const result = await service.ask(
      "A child is being threatened right now. What is the safest next step?",
      "en",
    );

    expect(result.generatedBy).toBe("grounded_fallback");
    expect(mockInteractionsCreate).not.toHaveBeenCalled();
  });

  it("falls back safely when Gemini returns an unusable response", async () => {
    mockInteractionsCreate.mockRejectedValue(new Error("provider unavailable"));

    const result = await service.ask(
      "Does the Constitution recognize a right to education?",
      "en",
    );

    expect(result.generatedBy).toBe("grounded_fallback");
    expect(result.legalReferences.every((reference) => reference.verified)).toBe(
      true,
    );
  });
});
