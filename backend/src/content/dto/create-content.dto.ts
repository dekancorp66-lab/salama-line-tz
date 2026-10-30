import { IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
export class CreateContentDto {
  @IsString() @MinLength(3) @MaxLength(100) slug: string;
  @IsString() @MinLength(3) @MaxLength(180) title: string;
  @IsIn(['sw', 'en']) language: string;
  @IsString() @MinLength(2) @MaxLength(60) topic: string;
  @IsString() @MinLength(10) @MaxLength(500) shortText: string;
  @IsString() @MinLength(10) @MaxLength(12000) fullText: string;
  @IsString() @MinLength(2) @MaxLength(200) sourceName: string;
  @IsOptional() @IsUrl() sourceUrl?: string;
}
