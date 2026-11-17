import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength, Matches } from 'class-validator';

export class CreateConsentPolicyDto {
  @ApiProperty({ example: 'salama-consent-v2' })
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  @Matches(/^[a-z0-9._-]+$/i, { message: 'version must use letters, numbers, dot, dash, or underscore' })
  version!: string;

  @ApiProperty({ description: 'Plain-language, approved consent wording' })
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  wording!: string;
}
