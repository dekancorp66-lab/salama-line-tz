import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** A super admin provisions an officer account in a pending (inactive) state. */
export class CreateOfficerDto {
  @ApiProperty({ example: 'officer@example.org' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'UseAStrongPassword123!', minLength: 12, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'Amani Juma', minLength: 2, maxLength: 80 })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName!: string;

  @ApiPropertyOptional({ example: 'MBEYA', description: 'District the officer may work in' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  districtCode?: string;

  @ApiPropertyOptional({ description: 'Institution this officer belongs to' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  institutionId?: string;
}
