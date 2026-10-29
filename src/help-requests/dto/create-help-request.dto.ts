import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
export class CreateHelpRequestDto {
  @IsString() @MinLength(2) @MaxLength(60) topic: string;
  @IsString() @MinLength(2) @MaxLength(20) districtCode: string;
  @IsIn(['WEB', 'USSD', 'SMS', 'WHATSAPP', 'STAFF']) channel: 'WEB'|'USSD'|'SMS'|'WHATSAPP'|'STAFF';
  @IsBoolean() consentToContact: boolean;
  @IsOptional() @IsString() @MaxLength(100) contact?: string;
  @IsOptional() @IsIn(['NORMAL', 'URGENT']) priority?: 'NORMAL'|'URGENT';
  @IsOptional() @IsBoolean() anonymousReport?: boolean;
}
