import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConversationTurnDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(2000)
  content!: string;
}

export class AskAiDto {
  @ApiProperty({
    minLength: 3,
    maxLength: 1200,
    example: 'Ninawezaje kupata msaada?',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(1200)
  question!: string;

  @ApiPropertyOptional({ enum: ['sw', 'en'], example: 'sw' })
  @IsOptional()
  @IsIn(['sw', 'en'])
  language?: 'sw' | 'en';

  @ApiPropertyOptional({
    type: [ConversationTurnDto],
    description: 'Previous conversation turns used to resolve follow-up questions.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationTurnDto)
  context?: ConversationTurnDto[];
}
