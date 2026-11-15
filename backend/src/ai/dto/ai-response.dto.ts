import { ApiProperty } from '@nestjs/swagger';

export class AiKnowledgeBaseHealthDto {
  @ApiProperty({ example: true, description: 'Whether at least one valid record was loaded.' })
  loaded!: boolean;

  @ApiProperty({ example: 25, description: 'Number of valid records loaded from the JSONL knowledge base.' })
  records!: number;
}

export class AiHealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: 'ok' | 'unavailable';

  @ApiProperty({ example: 'SalamaLine AI' })
  service!: string;

  @ApiProperty({ type: AiKnowledgeBaseHealthDto })
  knowledgeBase!: AiKnowledgeBaseHealthDto;
}

export class AiSourceDto {
  @ApiProperty({ example: 'WHO_TRAINING_2021' })
  id!: string;

  @ApiProperty({ example: 'WHO, Caring for Women Subjected to Violence: Training Curriculum (2021)' })
  name!: string;
}

export class AiAskResponseDto {
  @ApiProperty({ example: 'Msaada unapaswa kuzingatia haki, mahitaji, matakwa na usalama wa survivor.' })
  answer!: string;

  @ApiProperty({ enum: ['sw', 'en'], example: 'sw' })
  language!: 'sw' | 'en';

  @ApiProperty({ type: [AiSourceDto], example: [{ id: 'WHO_TRAINING_2021', name: 'WHO Training Curriculum (2021)' }] })
  sources!: AiSourceDto[];

  @ApiProperty({ enum: ['answered', 'no_reliable_answer', 'safety_guidance'], example: 'answered' })
  status!: 'answered' | 'no_reliable_answer' | 'safety_guidance';
}
