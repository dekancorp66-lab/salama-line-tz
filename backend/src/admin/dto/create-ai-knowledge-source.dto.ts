import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsHexadecimal,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAiKnowledgeSourceDto {
  @ApiProperty({ example: 'Constitution of Tanzania, Article 11' })
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @ApiProperty({ example: 'constitution', description: 'Stable source category, not a free-text note' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  sourceType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceUrl?: string;

  @ApiPropertyOptional({ example: 'MAINLAND_TANZANIA' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  jurisdiction?: string;

  @ApiProperty({ example: '2026-11-01' })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  version!: string;

  @ApiProperty({ description: 'SHA-256 digest of the approved source content' })
  @IsHexadecimal()
  @Length(64, 64)
  contentHash!: string;
}
