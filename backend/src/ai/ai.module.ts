import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AnswerGenerationService } from './answer-generation.service';
import { KnowledgeLoaderService } from './knowledge/knowledge-loader.service';
import { KnowledgeRetrievalService } from './knowledge/knowledge-retrieval.service';

@Module({
  controllers: [AiController],
  providers: [AiService, AnswerGenerationService, KnowledgeLoaderService, KnowledgeRetrievalService],
  exports: [AiService],
})
export class AiModule {}
