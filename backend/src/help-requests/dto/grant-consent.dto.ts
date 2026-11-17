import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConsentPurpose } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class GrantConsentDto {
  @ApiProperty({ enum: ConsentPurpose, example: ConsentPurpose.SHARE_WITH_SERVICE })
  @IsString()
  @IsIn(Object.values(ConsentPurpose))
  purpose!: ConsentPurpose;

  @ApiPropertyOptional({ description: 'Version of the approved consent wording' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  wordingVersion?: string;
}
