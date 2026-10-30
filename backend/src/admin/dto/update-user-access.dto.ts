import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserAccessDto {
  @ApiProperty({
    example: true,
    description: 'Set true to activate the account or false to deactivate it.',
  })
  @IsBoolean()
  isActive: boolean;

  @ApiPropertyOptional({
    enum: UserRole,
    example: UserRole.RESPONDER,
    description: 'Optionally change the account role.',
  })
  @IsOptional()
  @IsIn(Object.values(UserRole))
  role?: UserRole;

  @ApiPropertyOptional({
    example: 'MBEYA',
    maxLength: 20,
    description: 'Optionally assign a district; an empty string clears the district.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  districtCode?: string;
}
