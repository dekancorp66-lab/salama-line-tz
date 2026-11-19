import { IsIn } from 'class-validator';

export const ASSIGNABLE_STATUSES = [
  'NEW',
  'PENDING',
  'PENDING_REVIEW',
  'ACCEPTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'ESCALATED',
  'REFERRED',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
  'EXPIRED',
] as const;

export class UpdateHelpRequestStatusDto {
  @IsIn(ASSIGNABLE_STATUSES)
  status: (typeof ASSIGNABLE_STATUSES)[number];
}
