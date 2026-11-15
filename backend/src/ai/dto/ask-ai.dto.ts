import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
}
