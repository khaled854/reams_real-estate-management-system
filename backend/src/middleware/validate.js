'use strict';

/**
 * validate.js
 * Request validation middleware using Joi schemas.
 *
 * Usage:
 *   const { createPropertySchema } = require('../validators/propertyValidator');
 *   router.post('/', authenticate, validate(createPropertySchema), handler);
 */

const { sendError } = require('../utils/response');

/**
 * @param {import('joi').Schema} schema - Joi schema to validate against req.body
 */
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,   // collect all errors, not just the first
      stripUnknown: true,  // remove unknown fields from the body
    });

    if (error) {
      const errors = error.details.map((d) => ({
        field:   d.path.join('.'),
        message: d.message.replace(/['"]/g, ''),
      }));
      return sendError(res, { message: 'Validation failed', status: 422, errors });
    }

    req.body = value; // replace body with sanitised value
    next();
  };
}

module.exports = validate;
