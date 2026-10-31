'use strict';

/**
 * customerValidator.js
 * Joi v17 schemas for /api/v1/customers endpoints.
 *
 * Root cause of "Validation failed":
 *   The frontend CustomerForm.jsx sends budget / budget_min as an empty
 *   string "" when the user leaves those fields blank (React controlled
 *   inputs default to ""). Joi.number() rejects "" → 422.
 *
 * Fix — nullableNumber helper:
 *   Use Joi.any().custom() so the raw value reaches our code before any
 *   built-in type check. We convert "" → null, then validate as number.
 *   We do NOT chain .allow() because that short-circuits before custom().
 */

const Joi = require('joi');

const CUSTOMER_STATUSES = ['new', 'contacted', 'interested', 'negotiating', 'closed', 'lost'];

/**
 * Accepts:
 *   ""   (empty string)  → coerced to null
 *   null                 → kept as null
 *   undefined            → becomes null (field omitted)
 *   positive number      → validated and kept
 *   numeric string       → coerced to number and validated
 *
 * Rejects:
 *   0, negative numbers, non-numeric strings (e.g. "abc")
 */
const nullableNumber = Joi.any()
  .custom((value, helpers) => {
    if (value === undefined || value === '' || value === null) return null;

    const n = Number(value);
    if (isNaN(n))  return helpers.error('any.invalid');
    if (n <= 0)    return helpers.error('any.invalid');

    return Math.round(n * 100) / 100;   // max 2 decimal places
  }, 'nullable positive number')
  .optional()
  .default(null)
  .messages({ 'any.invalid': '{{#label}} must be a positive number' });

const createCustomerSchema = Joi.object({
  name:          Joi.string().trim().min(2).max(150).required(),
  phone:         Joi.string().trim().max(30).required(),
  email:         Joi.string().trim().email().lowercase().max(255).allow('', null).optional(),
  national_id:   Joi.string().trim().max(50).allow('', null).optional(),
  property_type: Joi.string().trim().max(100).allow('', null).optional(),
  location:      Joi.string().trim().max(200).allow('', null).optional(),
  budget:        nullableNumber,
  budget_min:    nullableNumber,
  notes:         Joi.string().trim().max(5000).allow('', null).optional(),
  status:        Joi.string().valid(...CUSTOMER_STATUSES).default('new'),
  source:        Joi.string().trim().max(100).allow('', null).optional(),
  employee_id:   Joi.number().integer().positive().allow(null).optional(),
});

const updateCustomerSchema = Joi.object({
  name:          Joi.string().trim().min(2).max(150).optional(),
  phone:         Joi.string().trim().max(30).optional(),
  email:         Joi.string().trim().email().lowercase().max(255).allow('', null).optional(),
  national_id:   Joi.string().trim().max(50).allow('', null).optional(),
  property_type: Joi.string().trim().max(100).allow('', null).optional(),
  location:      Joi.string().trim().max(200).allow('', null).optional(),
  budget:        nullableNumber,
  budget_min:    nullableNumber,
  notes:         Joi.string().trim().max(5000).allow('', null).optional(),
  source:        Joi.string().trim().max(100).allow('', null).optional(),
  employee_id:   Joi.number().integer().positive().allow(null).optional(),
}).min(1);

const updateStatusSchema = Joi.object({
  status: Joi.string().valid(...CUSTOMER_STATUSES).required(),
});

const assignEmployeeSchema = Joi.object({
  employee_id: Joi.number().integer().positive().required(),
});

module.exports = {
  createCustomerSchema,
  updateCustomerSchema,
  updateStatusSchema,
  assignEmployeeSchema,
};
