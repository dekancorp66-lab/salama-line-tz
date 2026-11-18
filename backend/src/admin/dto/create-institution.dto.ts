import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateInstitutionDto {
  @ApiProperty({ example: 'Mbeya Child Protection Network', maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'MBEYA-CPN', maxLength: 40 })
  @IsString()
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9-]+$/, { message: 'code must use letters, numbers or hyphens' })
  code: string;

  @ApiPropertyOptional({ example: 'MBEYA', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  districtCode?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
