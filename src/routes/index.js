import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes.js';
import { featureRouter } from '../modules/features/feature.routes.js';
import { generatorRouter } from '../modules/generator/generator.routes.js';
import { paymentRouter } from '../modules/payments/payment.routes.js';
import { projectRouter } from '../modules/projects/project.routes.js';
import { studioRouter } from '../modules/studio/studio.routes.js';
import 'dotenv/config';

export const router = Router();

router.use('/auth', authRouter);
router.use('/features', featureRouter);
router.use('/generate', generatorRouter);
router.use('/payments', paymentRouter);
router.use('/projects', projectRouter);
router.use('/studio', studioRouter);
