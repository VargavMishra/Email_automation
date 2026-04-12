import { buildProjectFiles, createZipBuffer, normalizeGenerationInput } from '../src/modules/generator/generator.engine.js';

describe('generator engine', () => {
  const request = {
    projectName: 'Acme API',
    paymentMode: 'mock',
    features: {
      auth: true,
      payments: true,
      apiGenerator: true
    },
    crudEntities: [
      {
        name: 'Post',
        route: 'posts',
        access: 'pro',
        fields: [
          { name: 'title', type: 'String', required: true },
          { name: 'published', type: 'Boolean', required: false }
        ]
      }
    ]
  };

  it('normalizes dependent features', () => {
    const config = normalizeGenerationInput(request);

    expect(config.packageName).toBe('acme-api');
    expect(config.features.auth).toBe(true);
    expect(config.features.subscriptions).toBe(true);
    expect(config.features.payments).toBe(true);
    expect(config.crudEntities[0].route).toBe('posts');
  });

  it('builds base, feature, prisma, and CRUD files', () => {
    const { files } = buildProjectFiles(request);

    expect(files['package.json']).toContain('"express"');
    expect(files['prisma/schema.prisma']).toContain('model User');
    expect(files['prisma/schema.prisma']).toContain('model Payment');
    expect(files['prisma/schema.prisma']).toContain('model Post');
    expect(files['src/modules/post/post.routes.js']).toContain("requirePlan('PRO')");
    expect(files['src/modules/payments/payment.routes.js']).toContain("paymentRouter.post('/verify'");
  });

  it('creates a non-empty zip buffer', async () => {
    const { files } = buildProjectFiles(request);
    const buffer = await createZipBuffer(files);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
  });
});
