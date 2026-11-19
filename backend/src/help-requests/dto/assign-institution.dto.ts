import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class AssignInstitutionDto {
  @ApiProperty({
    example: 'inst-123',
    description: 'Institution id to authorise for this case. An empty string clears the scope.',
  })
  @IsString()
  @MaxLength(64)
  institutionId: string;
}
