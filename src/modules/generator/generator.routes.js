import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { slugify } from '../../utils/security.js';
import { generateProjectZip } from './generator.engine.js';
import { generationRequestSchema } from './generator.schemas.js';

export const generatorRouter = Router();

generatorRouter.post('/', authenticate, validate(generationRequestSchema), asyncHandler(async (req, res) => {
  const result = await generateProjectZip(req.validated.body);
  const project = await prisma.project.create({
    data: {
      userId: req.user.id,
      name: result.config.projectName,
      slug: slugify(result.config.projectName),
      status: 'GENERATED',
      featureConfig: result.config,
      lastGeneratedAt: new Date()
    }
  });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${result.config.packageName}.zip"`);
  res.setHeader('X-Project-Id', project.id);
  res.setHeader('X-Generated-File-Count', String(result.fileCount));
  res.send(result.buffer);
}));
