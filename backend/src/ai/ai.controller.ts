import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AiService } from "./ai.service";
import { AskAiDto } from "./dto/ask-ai.dto";
import { AiAskResponseDto, AiHealthResponseDto } from "./dto/ai-response.dto";
import { Throttle } from "@nestjs/throttler";

@ApiTags("AI Knowledge Assistant")
@Controller("ai")
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get("health")
  @ApiOperation({ summary: "Check SalamaLine AI knowledge engine status" })
  @ApiOkResponse({
    type: AiHealthResponseDto,
    description: "Knowledge base readiness and loaded record count.",
  })
  health() {
    return this.aiService.health();
  }

  @Post("ask")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: "Ask the Mainland Tanzania knowledge assistant" })
  @ApiBody({
    type: AskAiDto,
    examples: {
      kiswahili: {
        summary: "Kiswahili question",
        value: { question: "Ninawezaje kupata msaada?", language: "sw" },
      },
      english: {
        summary: "English question",
        value: { question: "What support is available?", language: "en" },
      },
    },
  })
  @ApiOkResponse({
    type: AiAskResponseDto,
    description:
      "Retrieved answer, language, source references and answer status.",
  })
  ask(@Body() dto: AskAiDto) {
    return this.aiService.ask(dto.question.trim(), dto.language, dto.context);
  }
}
