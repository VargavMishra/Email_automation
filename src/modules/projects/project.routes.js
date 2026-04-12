import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { generationRequestSchema, projectIdSchema } from '../generator/generator.schemas.js';
import { createProject, downloadProject } from './project.service.js';

export const projectRouter = Router();

projectRouter.use(authenticate);

/**
 * @openapi
 * /api/projects:
 *   post:
 *     summary: Create and generate a SaaS backend project
 *     tags:
 *       - Projects
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: my-saas-app
 *     responses:
 *       201:
 *         description: Project generated successfully
 */
projectRouter.post('/', validate(generationRequestSchema), asyncHandler(async (req, res) => {
  const project = await createProject({
    userId: req.user.id,
    input: req.validated.body
  });

  res.status(201).json({ project });
}));


/**
 * @openapi
 * /api/projects/{id}/download:
 *   get:
 *     summary: Download generated project ZIP
 *     tags:
 *       - Projects
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: ZIP file download
 */
projectRouter.get('/:id/download', validate(projectIdSchema), asyncHandler(async (req, res) => {
  const result = await downloadProject({
    userId: req.user.id,
    projectId: req.validated.params.id
  });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${result.config.packageName}.zip"`);
  res.setHeader('X-Generated-File-Count', String(result.fileCount));
  res.send(result.buffer);
}));
