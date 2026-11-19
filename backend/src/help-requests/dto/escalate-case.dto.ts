import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class EscalateCaseDto {
  @ApiPropertyOptional({ description: 'Optional metadata-only escalation reason' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}
