const mockResponsesCreate = jest.fn();
const mockModerationsCreate = jest.fn();

jest.mock("openai", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    responses: { create: mockResponsesCreate },
    moderations: { create: mockModerationsCreate },
  })),
}));

import { AiScopePolicyService } from "./ai-scope-policy.service";
import { AiService } from "./ai.service";
import { AnswerGenerationService } from "./answer-generation.service";
import { KnowledgeLoaderService } from "./knowledge/knowledge-loader.service";
import { KnowledgeRetrievalService } from "./knowledge/knowledge-retrieval.service";

describe("OpenAI provider integration", () => {
  let service: AiService;
  let retrieval: KnowledgeRetrievalService;
  const originalEnv = { ...process.env };

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
    mockResponsesCreate.mockReset();
    mockModerationsCreate.mockReset();
    process.env.NODE_ENV = "test";
    process.env.OPENAI_API_KEY = "test-only-key";
    process.env.OPENAI_MODEL = "test-model";
    process.env.OPENAI_ENABLED = "true";
    process.env.OPENAI_MINOR_SAFEGUARDS_CONFIRMED = "false";
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  function mockSafeAnswer(directAnswer = "Article 11 protects access to education.") {
    mockResponsesCreate.mockResolvedValue({
      output_text: JSON.stringify({
        directAnswer,
        explanation: "This answer uses the verified constitutional record.",
        guidance: null,
      }),
    });
    mockModerationsCreate.mockResolvedValue({ results: [{ flagged: false }] });
  }

  it("uses the user's sanitized query with verified evidence and structured output", async () => {
    mockSafeAnswer();
    const question = "Does the Constitution recognize a right to education?";
    const result = await service.ask(question, "en");

    expect(result.generatedBy).toBe("configured_llm");
    expect(mockResponsesCreate).toHaveBeenCalledTimes(1);
    expect(mockModerationsCreate).toHaveBeenCalledTimes(1);
    const request = mockResponsesCreate.mock.calls[0][0];
    expect(request.model).toBe("test-model");
    expect(request.store).toBe(false);
    expect(request.text.format.type).toBe("json_schema");
    const transmitted = JSON.stringify(request.input);
    expect(transmitted).toContain("constitution_article_11");
    expect(transmitted).toContain(question);
    expect(transmitted).not.toContain('"question"');
    expect(result.legalReferences.every((reference) => reference.verified)).toBe(
      true,
    );
  });

  it("answers general questions in Swahili", async () => {
    mockSafeAnswer("Ndiyo. Katiba inatambua haki ya mtoto kupata elimu.");
    const result = await service.ask("Je, mtoto ana haki ya kupata elimu?", "sw");
    expect(result.generatedBy).toBe("configured_llm");
    expect(result.language).toBe("sw");
    expect(result.directAnswer).toMatch(/haki.*elimu/i);
  });

  it("redacts identifying details from the query sent to OpenAI", async () => {
    mockSafeAnswer("A child has a right to education.");
    await service.ask(
      "My sister Amina can she attend school? Contact me at 0712345678",
      "en",
    );
    const input = JSON.stringify(mockResponsesCreate.mock.calls[0][0].input);
    expect(input).toContain("[person removed]");
    expect(input).toContain("[number removed]");
    expect(input).not.toContain("Amina");
    expect(input).not.toContain("0712345678");
  });

  it("keeps personal disclosures, urgent risks, and health cases local", async () => {
    const questions = [
      "My sister is being threatened. What should I do?",
      "A child is in immediate danger right now.",
      "My relative plans to cut my younger sister.",
      "A relative plans to cut a girl tomorrow.",
      "A 14-year-old girl is being pressured to marry.",
      "What do I do about severe pain and heavy bleeding?",
    ];
    for (const question of questions) {
      const result = await service.ask(question, "en");
      expect(result.generatedBy).toBe("grounded_fallback");
    }
    expect(mockResponsesCreate).not.toHaveBeenCalled();
    expect(mockModerationsCreate).not.toHaveBeenCalled();
  });

  it("keeps unrelated questions on the scope redirect", async () => {
    const result = await service.ask("Can you teach me Python programming?", "en");
    expect(result.generatedBy).toBe("grounded_fallback");
    expect(result.directAnswer).toMatch(/SalamaLine focuses/i);
    expect(mockResponsesCreate).not.toHaveBeenCalled();
  });

  it("keeps production on local fallback until safeguarding confirmation", async () => {
    process.env.NODE_ENV = "production";
    const result = await service.ask(
      "Does the Constitution recognize a right to education?",
      "en",
    );
    expect(result.generatedBy).toBe("grounded_fallback");
    expect(mockResponsesCreate).not.toHaveBeenCalled();
  });

  it("falls back when output moderation flags a response", async () => {
    mockSafeAnswer("Flagged test answer.");
    mockModerationsCreate.mockResolvedValue({ results: [{ flagged: true }] });
    const result = await service.ask(
      "Does the Constitution recognize a right to education?",
      "en",
    );
    expect(result.generatedBy).toBe("grounded_fallback");
  });

  it("falls back safely when the provider fails", async () => {
    mockResponsesCreate.mockRejectedValue(new Error("provider unavailable"));
    const result = await service.ask(
      "Does the Constitution recognize a right to education?",
      "en",
    );
    expect(result.generatedBy).toBe("grounded_fallback");
    expect(mockModerationsCreate).not.toHaveBeenCalled();
  });

  it("falls back when a generated legal article is not in verified sources", async () => {
    mockSafeAnswer("Article 999 creates a new right.");
    const result = await service.ask(
      "Does the Constitution recognize a right to education?",
      "en",
    );
    expect(result.generatedBy).toBe("grounded_fallback");
    expect(mockModerationsCreate).not.toHaveBeenCalled();
  });
});
