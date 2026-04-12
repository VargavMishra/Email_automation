import { AppError } from '../utils/AppError.js';

export function validate(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query
    });

    if (!parsed.success) {
      return next(new AppError('Validation failed', 400, parsed.error.flatten()));
    }

    req.validated = parsed.data;
    return next();
  };
}
