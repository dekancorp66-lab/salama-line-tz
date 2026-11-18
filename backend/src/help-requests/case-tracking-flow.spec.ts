import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HelpRequestStatus } from '@prisma/client';
import request = require('supertest');
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtStrategy } from '../auth/jwt.strategy';
import { RolesGuard } from '../common/roles.guard';
import { PrismaService } from '../database/prisma.service';
import { HelpRequestsController } from './help-requests.controller';
import { HelpRequestsService } from './help-requests.service';
import { PublicCaseTrackingController } from './public-case-tracking.controller';
import { PublicCaseTrackingService } from './public-case-tracking.service';

describe('Full public case flow: submit -> reference -> track', () => {
  let app: INestApplication;
  const records = new Map<string, any>();
  const auditMock = { record: jest.fn().mockResolvedValue(undefined) };
  const prismaMock = {
    helpRequest: {
      create: jest.fn(async ({ data, select }: any) => {
        const stored = {
          id: 'internal-id',
          ...data,
          status: data.status ?? HelpRequestStatus.PENDING,
          createdAt: new Date('2026-01-01T08:00:00.000Z'),
          acceptedAt: null,
          assignedAt: null,
          escalatedAt: null,
          resolvedAt: null,
          closedAt: null,
        };
        records.set(stored.caseCode, stored);
        const selected: any = {};
        for (const key of Object.keys(select)) selected[key] = stored[key];
        return selected;
      }),
      findUnique: jest.fn(async ({ where }: any) => records.get(where.caseCode) ?? null),
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HelpRequestsController, PublicCaseTrackingController],
      providers: [
        HelpRequestsService,
        PublicCaseTrackingService,
        JwtAuthGuard,
        RolesGuard,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtStrategy, useValue: { authenticate: jest.fn() } },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('lets a help seeker submit a request and track it with the returned reference', async () => {
    const submitted = await request(app.getHttpServer())
      .post('/api/v1/help-requests')
      .send({
        topic: 'CHILD_MARRIAGE',
        districtCode: 'KYELA',
        channel: 'WEB',
        consentToContact: false,
      })
      .expect(201);

    const caseCode = submitted.body.caseCode;
    expect(caseCode).toMatch(/^SL-[0-9A-F]{16}$/);
    expect(submitted.body.id).toBeDefined();

    const tracked = await request(app.getHttpServer())
      .get(`/api/v1/case-tracking/${caseCode}`)
      .expect(200);

    expect(tracked.body).toEqual({
      caseCode,
      submittedAt: '2026-01-01T08:00:00.000Z',
      status: 'RECEIVED',
      lastUpdatedAt: '2026-01-01T08:00:00.000Z',
      progressUpdates: [
        { label: 'Help request received', at: '2026-01-01T08:00:00.000Z' },
      ],
      needsMoreInformation: false,
    });
    const serialized = JSON.stringify(tracked.body);
    expect(serialized).not.toContain('internal-id');
    expect(serialized).not.toContain('KYELA');
    expect(serialized).not.toContain('CHILD_MARRIAGE');
  });
});
