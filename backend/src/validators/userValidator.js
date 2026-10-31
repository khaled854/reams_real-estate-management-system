'use strict';

/**
 * userValidator.js
 * Joi schemas for the /api/v1/users endpoints.
 *
 * Role values in API requests use the external labels:
 *   'admin' | 'manager' | 'employee'
 * The model layer translates 'employee' → 'agent' before writing to the DB.
 */

const Joi = require('joi');

const PASSWORD_RULES = Joi.string()
  .min(8)
  .max(100)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .messages({
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    'string.min':          'Password must be at least 8 characters',
  });

/**
 * POST /api/v1/users — create a new user (admin only)
 */
const createUserSchema = Joi.object({
  name:     Joi.string().trim().min(2).max(150).required(),
  email:    Joi.string().trim().email().lowercase().max(255).required(),
  password: PASSWORD_RULES.required(),
  // Accept all three external role labels
  role:     Joi.string().valid('admin', 'manager', 'employee').default('employee'),
  phone:    Joi.string().trim().max(30).allow('', null).optional(),
});

/**
 * PUT /api/v1/users/:id — update user profile / role (admin only)
 */
const updateUserSchema = Joi.object({
  name:      Joi.string().trim().min(2).max(150).optional(),
  email:     Joi.string().trim().email().lowercase().max(255).optional(),
  phone:     Joi.string().trim().max(30).allow('', null).optional(),
  role:      Joi.string().valid('admin', 'manager', 'employee').optional(),
  is_active: Joi.boolean().optional(),
}).min(1); // at least one field required

/**
 * PATCH /api/v1/users/:id/password — admin reset any user's password
 */
const updatePasswordSchema = Joi.object({
  password: PASSWORD_RULES.required(),
});

module.exports = { createUserSchema, updateUserSchema, updatePasswordSchema };
