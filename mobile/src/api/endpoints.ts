import { api } from './client';

/** Types mirror the verified NestJS DTOs/selects documented in Phase 1. */

export interface ApprovedContent {
  id: string;
  slug: string;
  title: string;
  language: 'en' | 'sw';
  topic: string;
  shortText: string;
  fullText: string;
  sourceName: string;
  sourceUrl?: string | null;
  reviewedAt?: string | null;
}

export type ServiceType =
  | 'CLINIC'
  | 'LEGAL_AID'
  | 'SOCIAL_WELFARE'
  | 'SHELTER'
  | 'COUNSELLING'
  | 'OTHER';

export interface PublicService {
  id: string;
  name: string;
  type: ServiceType;
  districtCode: string;
  region: string;
  phonePublic?: string | null;
  address?: string | null;
  openingHours?: string | null;
  languages: string[];
  verificationOrg: string;
  verifiedAt: string;
  expiresAt?: string | null;
}

export interface CreateHelpRequestInput {
  topic: string;
  regionId: string;
  regionName: string;
  districtId: string;
  districtName: string;
  channel: 'WEB';
  consentToContact: boolean;
  contact?: string;
  concernSummary?: string;
  anonymousReport?: boolean;
  locationConsentGiven?: boolean;
  latitude?: number;
  longitude?: number;
  priority?: 'NORMAL' | 'URGENT';
}

export interface HelpRequestReceipt {
  id: string;
  caseCode: string;
  topic: string;
  status: string;
  createdAt: string;
  message: string;
}

export type PublicCaseStatus = 'RECEIVED' | 'UNDER_REVIEW' | 'IN_PROGRESS' | 'CLOSED';

export interface CaseTrackingResult {
  caseCode: string;
  submittedAt: string;
  status: PublicCaseStatus;
  lastUpdatedAt: string;
  progressUpdates: Array<{ label: string; at: string }>;
  needsMoreInformation: boolean;
}

export async function listApprovedContent(
  language: 'en' | 'sw',
  topic?: string,
): Promise<ApprovedContent[]> {
  const params: Record<string, string> = { language };
  if (topic) params.topic = topic;
  const response = await api.get<ApprovedContent[]>('/content', { params });
  return response.data;
}

export async function listPublicServices(filters?: {
  district?: string;
  type?: string;
}): Promise<PublicService[]> {
  const response = await api.get<PublicService[]>('/services', {
    params: {
      ...(filters?.district ? { district: filters.district } : {}),
      ...(filters?.type ? { type: filters.type } : {}),
    },
  });
  return response.data;
}

export async function submitHelpRequest(
  input: CreateHelpRequestInput,
): Promise<HelpRequestReceipt> {
  const response = await api.post<HelpRequestReceipt>('/help-requests', input);
  return response.data;
}

export async function trackCase(caseCode: string): Promise<CaseTrackingResult> {
  const response = await api.get<CaseTrackingResult>(
    `/case-tracking/${encodeURIComponent(caseCode.trim().toUpperCase())}`,
  );
  return response.data;
}
