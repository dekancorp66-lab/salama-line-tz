import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

/**
 * Only the public case reference is accepted. The internal database id is
 * never used as a tracking code and is not a valid value for this DTO.
 */
export class TrackCaseDto {
  @ApiProperty({
    example: 'SL-CC723587',
    description: 'Case reference number printed on the submission receipt',
    pattern: '^SL-[0-9A-F]{8}(?:[0-9A-F]{8})?$',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^SL-[0-9A-F]{8}(?:[0-9A-F]{8})?$/, {
    message: 'Enter a valid case reference number (for example SL-CC723587)',
  })
  caseCode: string;
}
