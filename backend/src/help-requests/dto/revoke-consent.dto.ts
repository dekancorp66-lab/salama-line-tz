import { ApiProperty } from '@nestjs/swagger';
import { ConsentPurpose } from '@prisma/client';
import { IsIn, IsString } from 'class-validator';

export class RevokeConsentDto {
  @ApiProperty({ enum: ConsentPurpose, example: ConsentPurpose.CONTACT_FOR_HELP })
  @IsString()
  @IsIn(Object.values(ConsentPurpose))
  purpose!: ConsentPurpose;
}
