import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateHelpRequestDto {
  @IsString() @MinLength(2) @MaxLength(60) topic: string;

  /**
   * Structured Tanzania Mainland location (preferred). When provided, the backend
   * resolves and validates the pair and derives the stored district code.
   */
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) regionId?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) regionName?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) districtId?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) districtName?: string;

  /**
   * Legacy/backward-compatible district identifier. Required when structured
   * region/district IDs are not provided.
   */
  @ValidateIf((o) => !o.regionId && !o.districtId)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  districtCode?: string;

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

  /**
   * Optional GPS coordinates. Stored only when locationConsentGiven is true and
   * the reporter explicitly chose to include them.
   */
  @IsOptional() @IsBoolean() locationConsentGiven?: boolean;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
}
