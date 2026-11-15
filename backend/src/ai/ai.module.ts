import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { KnowledgeLoaderService } from './knowledge/knowledge-loader.service';
import { KnowledgeRetrievalService } from './knowledge/knowledge-retrieval.service';

@Module({
  controllers: [AiController],
  providers: [AiService, KnowledgeLoaderService, KnowledgeRetrievalService],
  exports: [AiService],
})
export class AiModule {}
