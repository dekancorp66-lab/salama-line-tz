import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserRole } from '@prisma/client';

/** Roles a super admin may grant when approving an officer account. */
export const APPROVABLE_OFFICER_ROLES = [
  UserRole.RESPONDER,
  UserRole.ADMIN,
  UserRole.CONTENT_REVIEWER,
  UserRole.CONTENT_MANAGER,
  UserRole.SERVICE_MANAGER,
  UserRole.AUDITOR,
  UserRole.PARTNER_ANALYST,
] as const;

export class ApproveOfficerDto {
  @ApiPropertyOptional({ enum: APPROVABLE_OFFICER_ROLES, example: UserRole.RESPONDER })
  @IsOptional()
  @IsIn(APPROVABLE_OFFICER_ROLES)
  role?: UserRole;

  @ApiPropertyOptional({ example: 'MBEYA' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  districtCode?: string;

  @ApiPropertyOptional({ description: 'Institution this officer may access' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  institutionId?: string;
}
