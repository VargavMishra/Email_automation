import { Router } from 'express';
import { getFeatureList } from '../generator/generator.engine.js';

export const featureRouter = Router();

featureRouter.get('/', (_req, res) => {
  res.json({ features: getFeatureList() });
});
