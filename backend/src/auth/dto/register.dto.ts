import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address for the new SalamaLine account',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'UseAStrongPassword123!',
    description: 'Password for the new account',
    minLength: 12,
    maxLength: 128,
    writeOnly: true,
  })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;

  @ApiProperty({
    example: 'Amani Juma',
    description: 'Name displayed on the user profile',
    minLength: 2,
    maxLength: 80,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName: string;
}
