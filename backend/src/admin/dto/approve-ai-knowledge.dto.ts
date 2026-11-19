import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ApproveAiKnowledgeDto {
  @ApiProperty({ description: 'Set true to approve for live use; false to withdraw approval' })
  @IsBoolean()
  approved!: boolean;
}
