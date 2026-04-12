import archiver from 'archiver';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { defaultFeatureSelection, featureCatalog, normalizeFeatures } from '../../config/features.js';
import { slugify } from '../../utils/security.js';
import { renderAuthFiles, renderEmailFiles } from './generated-auth-template.js';
import {
  renderApp,
  renderCommonFiles,
  renderConfigEnv,
  renderConfigFeatures,
  renderDockerCompose,
  renderDockerfile,
  renderEnv,
  renderLogger,
  renderPackageJson,
  renderPrismaClient,
  renderReadme,
  renderRouteIndex,
  renderServer,
  renderSwaggerConfig,
  renderAuthMiddleware
} from './generated-app-templates.js';
import { renderPaymentFiles } from './generated-payment-template.js';
import { generationRequestBodySchema } from './generator.schemas.js';
import { kebabCase } from './name-utils.js';
import { renderCrudFiles } from './crud-renderer.js';
import { renderPrismaSchema } from './prisma-renderer.js';

function normalizeEntity(entity) {
  return {
    ...entity,
    route: entity.route ?? kebabCase(entity.name)
  };
}

export function normalizeGenerationInput(input) {
  const parsed = generationRequestBodySchema.parse(input);
  const features = normalizeFeatures(parsed.features);
  const crudEntities = parsed.crudEntities.map(normalizeEntity);

  if (crudEntities.length > 0) {
    features.apiGenerator = true;
  }

  if (features.payments) {
    features.auth = true;
    features.subscriptions = true;
  }

  if (features.subscriptions || features.email || features.rbac) {
    features.auth = true;
  }

  for (const entity of crudEntities) {
    if (entity.access !== 'public') {
      features.auth = true;
    }
    if (entity.access === 'admin') {
      features.rbac = true;
    }
    if (entity.access === 'pro') {
      features.subscriptions = true;
    }
  }

  const packageName = parsed.packageName ?? slugify(parsed.projectName);

  return {
    ...parsed,
    packageName,
    description: parsed.description ?? `${parsed.projectName} backend API`,
    features,
    crudEntities
  };
}

export function getFeatureList() {
  return Object.entries(featureCatalog).map(([key, value]) => ({
    key,
    enabledByDefault: defaultFeatureSelection[key] ?? false,
    ...value
  }));
}

export function buildProjectFiles(input) {
  const config = normalizeGenerationInput(input);
  const { features, crudEntities, packageName, projectName, description, paymentMode } = config;

  const files = {
    'package.json': renderPackageJson({ packageName, description, features, paymentMode }),
    '.env': renderEnvWithGeneratedSecrets(renderEnv({ packageName, features, paymentMode }), paymentMode),
    '.env.example': renderEnv({ packageName, features, paymentMode }),
    '.gitignore': ['node_modules/', '.env', 'coverage/', 'dist/', '*.log'].join('\n'),
    'README.md': renderReadme({ projectName, features, crudEntities }),
    'prisma/schema.prisma': renderPrismaSchema({ features, crudEntities }),
    'src/config/env.js': renderConfigEnv(features),
    'src/config/features.js': renderConfigFeatures(features),
    'src/config/prisma.js': renderPrismaClient(),
    'src/logger.js': renderLogger(features),
    'src/app.js': renderApp(features),
    'src/server.js': renderServer(),
    'src/routes/index.js': renderRouteIndex({ features, crudEntities }),
    ...renderCommonFiles(features)
  };

  if (features.swagger) {
    files['src/config/swagger.js'] = renderSwaggerConfig(features);
  }

  if (features.auth) {
    files['src/middleware/auth.js'] = renderAuthMiddleware();
    Object.assign(files, renderAuthFiles(features));
  }

  if (features.email) {
    Object.assign(files, renderEmailFiles());
  }

  if (features.payments) {
    Object.assign(files, renderPaymentFiles());
  }

  if (features.docker) {
    files.Dockerfile = renderDockerfile();
    files['docker-compose.yml'] = renderDockerCompose(packageName);
  }

  for (const entity of crudEntities) {
    Object.assign(files, renderCrudFiles(entity));
  }

  return { files, config };
}

function renderEnvWithGeneratedSecrets(envContent, paymentMode) {
  const access = cryptoRandomHex();
  const refresh = cryptoRandomHex();

  return envContent
    .replace('JWT_ACCESS_SECRET=replace-with-a-long-random-access-secret', `JWT_ACCESS_SECRET=${access}`)
    .replace('JWT_REFRESH_SECRET=replace-with-a-long-random-refresh-secret', `JWT_REFRESH_SECRET=${refresh}`)
    .replace('PAYMENT_PROVIDER=mock', `PAYMENT_PROVIDER=${paymentMode}`);
}

function cryptoRandomHex() {
  return randomBytes(32).toString('hex');
}

export async function createZipBuffer(files) {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const stream = new PassThrough();
  const chunks = [];

  stream.on('data', (chunk) => chunks.push(chunk));

  const completion = new Promise((resolve, reject) => {
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
    stream.on('error', reject);
  });

  archive.pipe(stream);

  for (const [filePath, content] of Object.entries(files)) {
    archive.append(content, { name: filePath });
  }

  await archive.finalize();
  return completion;
}

export async function generateProjectZip(input) {
  const { files, config } = buildProjectFiles(input);
  const buffer = await createZipBuffer(files);

  return {
    buffer,
    config,
    fileCount: Object.keys(files).length
  };
}

export async function writeProjectToDirectory(input, outputDirectory) {
  const { files, config } = buildProjectFiles(input);
  const projectRoot = path.resolve(outputDirectory, config.packageName);

  await fs.mkdir(projectRoot, { recursive: true });

  await Promise.all(Object.entries(files).map(async ([filePath, content]) => {
    const target = path.join(projectRoot, filePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf8');
  }));

  return {
    projectRoot,
    fileCount: Object.keys(files).length,
    config
  };
}
