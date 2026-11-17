import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateServiceEntryDto {
  @ApiProperty({ example: "Mbeya Women's Health Clinic" })
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name!: string;

  @ApiProperty({ enum: ServiceType, example: ServiceType.CLINIC })
  @IsIn(Object.values(ServiceType))
  type!: ServiceType;

  @ApiProperty({ example: 'MBEYA' })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  districtCode!: string;

  @ApiProperty({ example: 'Mbeya' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  region!: string;

  @ApiPropertyOptional({ example: '0750000000' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phonePublic?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  openingHours?: string;

  @ApiPropertyOptional({ type: [String], example: ['sw', 'en'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  languages?: string[];

  @ApiProperty({ example: 'Verified District Health Office' })
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  verificationOrg!: string;

  @ApiProperty({ example: 'reviewer-1', description: 'Identifier of the staff member who verified the source record' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  verifiedBy!: string;

  @ApiProperty({ example: '2026-01-15T00:00:00.000Z' })
  @IsDateString()
  verifiedAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
