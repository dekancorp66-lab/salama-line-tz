import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AssignCaseDto {
  @ApiProperty({ description: 'Identifier of the responder to assign the case to' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  responderId!: string;

  @ApiPropertyOptional({ description: 'Optional metadata-only reason for the assignment' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;

  @ApiPropertyOptional({ description: 'Reassign even when another responder holds the case' })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
