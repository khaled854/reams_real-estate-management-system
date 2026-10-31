'use strict';

const Joi = require('joi');

const passwordRules = Joi.string()
  .min(8)
  .max(100)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .messages({
    'string.pattern.base':
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    'string.min': 'Password must be at least 8 characters',
  });

const registerSchema = Joi.object({
  name:     Joi.string().trim().min(2).max(150).required(),
  email:    Joi.string().trim().email().lowercase().max(255).required(),
  password: passwordRules.required(),
  role:     Joi.string().valid('admin', 'manager', 'employee').default('employee'),
  phone:    Joi.string().trim().max(30).allow('', null).optional(),
});

const loginSchema = Joi.object({
  email:    Joi.string().trim().email().lowercase().required(),
  password: Joi.string().required(),
});

const changePasswordSchema = Joi.object({
  current_password: Joi.string().required(),
  new_password:     passwordRules.required(),
});

module.exports = { registerSchema, loginSchema, changePasswordSchema };
