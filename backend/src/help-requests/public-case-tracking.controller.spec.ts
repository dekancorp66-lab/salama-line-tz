import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { HelpRequestStatus } from '@prisma/client';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request = require('supertest');
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { PublicCaseTrackingController } from './public-case-tracking.controller';
import { PublicCaseTrackingService } from './public-case-tracking.service';

const trackingRecord = {
  id: 'internal-id',
  caseCode: 'SL-CC723587',
  status: HelpRequestStatus.PENDING,
  createdAt: new Date('2026-01-01T08:00:00.000Z'),
  acceptedAt: null,
  assignedAt: null,
  escalatedAt: null,
  resolvedAt: null,
  closedAt: null,
};

async function createApp() {
  const auditMock = { record: jest.fn().mockResolvedValue(undefined) };
  const prismaMock = { helpRequest: { findUnique: jest.fn().mockResolvedValue({ ...trackingRecord }) } };
  const moduleRef = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
    controllers: [PublicCaseTrackingController],
    providers: [
      PublicCaseTrackingService,
      { provide: PrismaService, useValue: prismaMock },
      { provide: AuditService, useValue: auditMock },
      { provide: APP_GUARD, useClass: ThrottlerGuard },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
  return { app, prismaMock, auditMock };
}

describe('PublicCaseTrackingController', () => {
  let app: INestApplication;
  let prismaMock: Awaited<ReturnType<typeof createApp>>['prismaMock'];

  beforeAll(async () => {
    const created = await createApp();
    app = created.app;
    prismaMock = created.prismaMock;
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it('returns safe tracking data without authentication', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/case-tracking/SL-CC723587')
      .expect(200);

    expect(response.body).toMatchObject({
      caseCode: 'SL-CC723587',
      status: 'RECEIVED',
      needsMoreInformation: false,
    });
    expect(response.body).not.toHaveProperty('id');
    expect(response.body).not.toHaveProperty('topic');
    expect(response.body).not.toHaveProperty('notes');
  });

  it('accepts lowercase input by normalizing the reference', async () => {
    await request(app.getHttpServer()).get('/api/v1/case-tracking/sl-cc723587').expect(200);
    expect(prismaMock.helpRequest.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { caseCode: 'SL-CC723587' } }),
    );
  });

  it('rejects malformed references with 400', async () => {
    for (const code of ['SL-123', 'abc', 'SL-GGGGGGGG', 'SL-CC723587;DROP']) {
      await request(app.getHttpServer()).get(`/api/v1/case-tracking/${code}`).expect(400);
    }
  });

  it('rejects an internal database id used as a tracking code', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/case-tracking/cmwl1pc6n000ey92bkg6j464x')
      .expect(400);
    expect(prismaMock.helpRequest.findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 for a well-formed but unknown reference', async () => {
    prismaMock.helpRequest.findUnique.mockResolvedValueOnce(null);
    await request(app.getHttpServer()).get('/api/v1/case-tracking/SL-00000000').expect(404);
  });
});

describe('PublicCaseTrackingController rate limiting', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createApp());
  });

  afterAll(async () => {
    await app?.close();
  });

  it('limits repeated lookups to 8 per minute (stricter than the global 60)', async () => {
    for (let i = 0; i <= 8; i += 1) {
      const res = await request(app.getHttpServer()).get('/api/v1/case-tracking/SL-CC723587');
      if (i < 8) expect(res.status).toBe(200);
      else expect(res.status).toBe(429);
    }
  });
});
