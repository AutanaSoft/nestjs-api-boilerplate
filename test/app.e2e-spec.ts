import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { setupApplication } from './../src/app.setup.js';
import httpConfig from './../src/config/http.config.js';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  const environment = {
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    THROTTLE_LIMIT: process.env.THROTTLE_LIMIT,
    THROTTLE_TTL_SECONDS: process.env.THROTTLE_TTL_SECONDS,
  };

  beforeAll(() => {
    process.env.CORS_ORIGINS = 'https://allowed.example';
    process.env.THROTTLE_LIMIT = '2';
    process.env.THROTTLE_TTL_SECONDS = '60';
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApplication(app, app.get(httpConfig.KEY));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(environment)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('/ (GET) returns the existing response with Helmet headers', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(200);

    expect(response.text).toBe('Hello World!');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('allows configured CORS origins and denies unconfigured origins', async () => {
    const allowed = await request(app.getHttpServer()).get('/').set('Origin', 'https://allowed.example').expect(200);
    const denied = await request(app.getHttpServer()).get('/').set('Origin', 'https://denied.example').expect(200);

    expect(allowed.headers['access-control-allow-origin']).toBe('https://allowed.example');
    expect(allowed.headers['access-control-allow-credentials']).toBeUndefined();
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('accepts a preflight request from an allowed origin', async () => {
    const response = await request(app.getHttpServer())
      .options('/')
      .set('Origin', 'https://allowed.example')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe('https://allowed.example');
  });

  it('returns 429 after the configured request limit', async () => {
    await request(app.getHttpServer()).get('/').expect(200);
    await request(app.getHttpServer()).get('/').expect(200);
    await request(app.getHttpServer()).get('/').expect(429);
  });
});
