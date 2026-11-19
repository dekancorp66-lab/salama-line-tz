import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class ResponderAvailabilityDto {
  @ApiProperty({ description: 'Whether this responder may receive new case alerts' })
  @IsBoolean()
  available!: boolean;

  @ApiPropertyOptional({ example: 'MBEYA', description: 'Optional district override' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  districtCode?: string;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxActiveCases?: number;
}
