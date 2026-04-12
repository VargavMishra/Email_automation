import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { slugify } from '../../utils/security.js';
import { generateProjectZip, normalizeGenerationInput } from '../generator/generator.engine.js';

export async function createProject({ userId, input }) {
  const config = normalizeGenerationInput(input);

  return prisma.project.create({
    data: {
      userId,
      name: config.projectName,
      slug: slugify(config.projectName),
      status: 'DRAFT',
      featureConfig: config
    }
  });
}

export async function downloadProject({ userId, projectId }) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId
    }
  });

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  const result = await generateProjectZip(project.featureConfig);

  await prisma.project.update({
    where: { id: project.id },
    data: {
      status: 'GENERATED',
      lastGeneratedAt: new Date()
    }
  });

  return result;
}
