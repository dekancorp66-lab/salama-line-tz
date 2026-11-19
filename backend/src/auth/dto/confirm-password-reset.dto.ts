import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class ConfirmPasswordResetDto {
  @ApiProperty({ example: 'responder@example.org' })
  @IsEmail()
  @IsString()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ description: 'Single-use recovery token', minLength: 64, maxLength: 64 })
  @IsString()
  @Length(64, 64)
  token!: string;

  @ApiProperty({ description: 'New account password', minLength: 12, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}
