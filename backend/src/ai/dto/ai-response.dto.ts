import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AiKnowledgeBaseHealthDto {
  @ApiProperty({ example: true, description: 'Whether searchable evidence records were loaded.' })
  loaded!: boolean;

  @ApiProperty({ example: 255, description: 'Number of loaded knowledge, Q&A, legal evidence and Constitution page records.' })
  records!: number;
}

export class AiHealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: 'ok' | 'unavailable';

  @ApiProperty({ example: 'SalamaLine AI' })
  service!: string;

  @ApiProperty({ type: AiKnowledgeBaseHealthDto })
  knowledgeBase!: AiKnowledgeBaseHealthDto;

  @ApiPropertyOptional({ example: { mode: 'grounded_fallback' } })
  answerGeneration?: { mode: string };
}

export class AiSourceDto {
  @ApiProperty({ example: 'TZA_LCA_2023', description: 'Internal stable key; the frontend displays the source name.' })
  id!: string;

  @ApiProperty({ example: 'The Law of the Child Act, Cap. 13 R.E. 2023' })
  name!: string;

  @ApiPropertyOptional({ example: 'Section 160(1)' })
  reference?: string;

  @ApiPropertyOptional({ example: 'https://oagmis.oag.go.tz/portal/acts/revised/555/download' })
  url?: string;
}

export class AiLegalReferenceDto {
  @ApiProperty({ example: 'The Law of the Child Act, Cap. 13 R.E. 2023' })
  source!: string;

  @ApiProperty({ example: 'Section 160(1)–(2)' })
  reference!: string;

  @ApiProperty({ example: true, description: 'Whether this provision was checked against the cited source.' })
  verified!: boolean;

  @ApiPropertyOptional({ example: 'Mainland Tanzania' })
  jurisdiction?: string;

  @ApiPropertyOptional({ example: 'https://oagmis.oag.go.tz/portal/acts/revised/555/download' })
  url?: string;

  @ApiPropertyOptional({ example: 'Official OAG English revision consolidated through 2005.' })
  note?: string;
}

export class AiSafetyStatusDto {
  @ApiProperty({ example: false })
  escalate!: boolean;

  @ApiProperty({ example: 'standard' })
  reason!: string;

  @ApiProperty({ example: false })
  humanSupportRecommended!: boolean;
}

export class AiAskResponseDto {
  @ApiProperty({ example: 'Hapana. Ukeketaji wa mtoto wa kike haupaswi kufanywa.' })
  answer!: string;

  @ApiProperty({ example: 'Hapana. Ukeketaji wa mtoto wa kike haupaswi kufanywa.' })
  directAnswer!: string;

  @ApiProperty({ example: 'Sheria ya Mtoto, kifungu cha 160(1), inakataza kumfanyia mtoto ukeketaji.' })
  explanation!: string;

  @ApiPropertyOptional({ example: 'Ikiwa mtoto anaweza kuwa kwenye hatari, tafuta msaada kutoka kwa mtu mzima anayeaminika.' })
  guidance?: string;

  @ApiProperty({ enum: ['sw', 'en'], example: 'sw' })
  language!: 'sw' | 'en';

  @ApiProperty({ type: [AiSourceDto], example: [{ id: 'TZA_LCA_2023', name: 'The Law of the Child Act, Cap. 13 R.E. 2023', reference: 'Section 160(1)' }] })
  sources!: AiSourceDto[];

  @ApiProperty({ type: [AiLegalReferenceDto], example: [{ source: 'The Law of the Child Act, Cap. 13 R.E. 2023', reference: 'Section 160(1)–(2)', verified: true, jurisdiction: 'Mainland Tanzania' }] })
  legalReferences!: AiLegalReferenceDto[];

  @ApiProperty({ enum: ['answered', 'no_reliable_answer', 'safety_guidance'], example: 'answered' })
  status!: 'answered' | 'no_reliable_answer' | 'safety_guidance';

  @ApiProperty({ enum: ['grounded_fallback', 'configured_llm'], example: 'grounded_fallback' })
  generatedBy!: 'grounded_fallback' | 'configured_llm';

  @ApiProperty({ type: AiSafetyStatusDto })
  safety!: AiSafetyStatusDto;

}
