import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateHelpRequestDto {
  @IsString() @MinLength(2) @MaxLength(60) topic: string;
  @IsString() @MinLength(2) @MaxLength(20) districtCode: string;
  @IsIn(['WEB', 'USSD', 'SMS', 'WHATSAPP', 'STAFF'])
  channel: 'WEB' | 'USSD' | 'SMS' | 'WHATSAPP' | 'STAFF';
  @IsBoolean() consentToContact: boolean;
  @IsOptional() @IsString() @MaxLength(100) contact?: string;
  @IsOptional() @IsIn(['NORMAL', 'URGENT']) priority?: 'NORMAL' | 'URGENT';
  @IsOptional() @IsBoolean() anonymousReport?: boolean;
  /**
   * Optional free-text concern. This is redacted (emails, phone numbers,
   * identifying detail patterns) and truncated before it is ever persisted.
   * Raw message text is never stored.
   */
  @IsOptional() @IsString() @MaxLength(2000) concernSummary?: string;
}
