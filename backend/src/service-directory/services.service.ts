import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}
  list(districtCode?: string, type?: string) {
    const now = new Date();
    return this.prisma.serviceDirectoryEntry.findMany({
      where: { isActive: true, verifiedAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        ...(districtCode ? { districtCode: districtCode.toUpperCase() } : {}),
        ...(type ? { type: type as any } : {}) },
      select: { id: true, name: true, type: true, districtCode: true, region: true, phonePublic: true, address: true, openingHours: true, languages: true, verificationOrg: true, verifiedAt: true, expiresAt: true },
      orderBy: [{ districtCode: 'asc' }, { name: 'asc' }],
    });
  }
}
