import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class RequestPasswordResetDto {
  @ApiProperty({ example: 'responder@example.org', description: 'Email address of the account to recover' })
  @IsEmail()
  @IsString()
  @MaxLength(254)
  email!: string;
}
