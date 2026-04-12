import { camelCase, kebabCase } from './name-utils.js';

const zodByType = {
  String: 'z.string()',
  Int: 'z.coerce.number().int()',
  Float: 'z.coerce.number()',
  Boolean: 'z.coerce.boolean()',
  DateTime: 'z.coerce.date()',
  Json: 'z.unknown()'
};

function fieldValidator(field) {
  const base = zodByType[field.type] ?? 'z.string()';
  return `${field.name}: ${field.required ? base : `${base}.optional()`}`;
}

function renderSchemas(entity) {
  const validators = entity.fields.map(fieldValidator).join(',\n    ');

  return `import { z } from 'zod';

const payloadSchema = z.object({
    ${validators}
});

export const create${entity.name}Schema = z.object({
  body: payloadSchema
});

export const update${entity.name}Schema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: payloadSchema.partial().refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  })
});

export const ${camelCase(entity.name)}IdSchema = z.object({
  params: z.object({ id: z.string().min(1) })
});
`;
}

function renderService(entity) {
  const model = camelCase(entity.name);

  return `import { prisma } from '../../config/prisma.js';

export function create${entity.name}(data) {
  return prisma.${model}.create({ data });
}

export function list${entity.name}s({ page = 1, limit = 20 } = {}) {
  const take = Math.min(Number(limit) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  return prisma.${model}.findMany({
    skip,
    take,
    orderBy: { createdAt: 'desc' }
  });
}

export function get${entity.name}(id) {
  return prisma.${model}.findUnique({ where: { id } });
}

export function update${entity.name}(id, data) {
  return prisma.${model}.update({
    where: { id },
    data
  });
}

export function delete${entity.name}(id) {
  return prisma.${model}.delete({ where: { id } });
}
`;
}

function renderController(entity) {
  const lower = camelCase(entity.name);

  return `import { AppError } from '../../utils/AppError.js';
import {
  create${entity.name},
  delete${entity.name},
  get${entity.name},
  list${entity.name}s,
  update${entity.name}
} from './${kebabCase(entity.name)}.service.js';

export async function create${entity.name}Handler(req, res) {
  const ${lower} = await create${entity.name}(req.validated.body);
  res.status(201).json({ ${lower} });
}

export async function list${entity.name}sHandler(req, res) {
  const ${lower}s = await list${entity.name}s(req.query);
  res.json({ ${lower}s });
}

export async function get${entity.name}Handler(req, res) {
  const ${lower} = await get${entity.name}(req.validated.params.id);

  if (!${lower}) {
    throw new AppError('${entity.name} not found', 404);
  }

  res.json({ ${lower} });
}

export async function update${entity.name}Handler(req, res) {
  const ${lower} = await update${entity.name}(req.validated.params.id, req.validated.body);
  res.json({ ${lower} });
}

export async function delete${entity.name}Handler(req, res) {
  await delete${entity.name}(req.validated.params.id);
  res.status(204).send();
}
`;
}

function guardImports(entity) {
  if (entity.access === 'public') {
    return '';
  }

  const imports = ['authenticate'];
  if (entity.access === 'admin') {
    imports.push('authorize');
  }
  if (entity.access === 'pro') {
    imports.push('requirePlan');
  }

  return `import { ${imports.join(', ')} } from '../../middleware/auth.js';\n`;
}

function guardMiddleware(entity) {
  if (entity.access === 'public') {
    return '';
  }

  if (entity.access === 'admin') {
    return "\nrouter.use(authenticate, authorize('ADMIN'));\n";
  }

  if (entity.access === 'pro') {
    return "\nrouter.use(authenticate, requirePlan('PRO'));\n";
  }

  return '\nrouter.use(authenticate);\n';
}

function renderRoutes(entity) {
  return `import { Router } from 'express';
${guardImports(entity)}import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  create${entity.name}Handler,
  delete${entity.name}Handler,
  get${entity.name}Handler,
  list${entity.name}sHandler,
  update${entity.name}Handler
} from './${kebabCase(entity.name)}.controller.js';
import {
  create${entity.name}Schema,
  ${camelCase(entity.name)}IdSchema,
  update${entity.name}Schema
} from './${kebabCase(entity.name)}.schemas.js';

export const ${camelCase(entity.name)}Router = Router();
const router = ${camelCase(entity.name)}Router;
${guardMiddleware(entity)}
router.get('/', asyncHandler(list${entity.name}sHandler));
router.post('/', validate(create${entity.name}Schema), asyncHandler(create${entity.name}Handler));
router.get('/:id', validate(${camelCase(entity.name)}IdSchema), asyncHandler(get${entity.name}Handler));
router.patch('/:id', validate(update${entity.name}Schema), asyncHandler(update${entity.name}Handler));
router.delete('/:id', validate(${camelCase(entity.name)}IdSchema), asyncHandler(delete${entity.name}Handler));
`;
}

export function renderCrudFiles(entity) {
  const folder = `src/modules/${kebabCase(entity.name)}`;
  const fileBase = kebabCase(entity.name);

  return {
    [`${folder}/${fileBase}.schemas.js`]: renderSchemas(entity),
    [`${folder}/${fileBase}.service.js`]: renderService(entity),
    [`${folder}/${fileBase}.controller.js`]: renderController(entity),
    [`${folder}/${fileBase}.routes.js`]: renderRoutes(entity)
  };
}
