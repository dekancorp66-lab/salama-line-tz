import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCaseNoteDto {
  /**
   * Case metadata only. Contact patterns are redacted server-side; notes that
   * are empty after redaction are rejected.
   */
  @ApiProperty({ description: 'Case metadata only; never names or contact details' })
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  note!: string;
}
