import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateReferralDto {
  @ApiProperty({
    description: 'Identifier of an active, verified service directory entry',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  serviceEntryId!: string;

  @ApiPropertyOptional({ description: 'Optional metadata-only referral note' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
