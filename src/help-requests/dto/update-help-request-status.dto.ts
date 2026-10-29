import { IsIn } from 'class-validator';
export class UpdateHelpRequestStatusDto {
  @IsIn(['ACCEPTED', 'IN_PROGRESS', 'REFERRED', 'CLOSED', 'CANCELLED'])
  status: 'ACCEPTED'|'IN_PROGRESS'|'REFERRED'|'CLOSED'|'CANCELLED';
}
