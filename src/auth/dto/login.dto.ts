
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address registered with SalamaLine',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'EnterYourPassword123!',
    description: 'Account password',
    minLength: 1,
    maxLength: 128,
    writeOnly: true,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}
