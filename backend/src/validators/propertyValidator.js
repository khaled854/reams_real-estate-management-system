'use strict';

const Joi = require('joi');

const PAYMENT_METHODS  = ['cash', 'installment', 'mortgage', 'lease', 'negotiable'];
const LISTING_TYPES    = ['sale', 'rent', 'both'];
const PROPERTY_STATUSES = ['available', 'rented', 'sold', 'reserved', 'off_market'];

const createPropertySchema = Joi.object({
  type_id:              Joi.number().integer().positive().required(),
  type:                 Joi.string().trim().max(100).required(),
  title:                Joi.string().trim().min(3).max(255).required(),
  description:          Joi.string().trim().max(5000).allow('', null).optional(),
  location:             Joi.string().trim().max(200).required(),
  address:              Joi.string().trim().max(500).required(),
  area:                 Joi.number().positive().precision(2).required(),
  rooms:                Joi.number().integer().min(0).max(99).allow(null).optional(),
  bedrooms:             Joi.number().integer().min(0).max(99).allow(null).optional(),
  bathrooms:            Joi.number().integer().min(0).max(99).allow(null).optional(),
  floor:                Joi.number().integer().min(-5).max(200).allow(null).optional(),
  price:                Joi.number().positive().precision(2).required(),
  payment_method:       Joi.string().valid(...PAYMENT_METHODS).default('cash'),
  owner_name:           Joi.string().trim().max(150).required(),
  owner_phone:          Joi.string().trim().max(30).required(),
  listing_type:         Joi.string().valid(...LISTING_TYPES).default('sale'),
  status:               Joi.string().valid(...PROPERTY_STATUSES).default('available'),
  is_featured:          Joi.boolean().default(false),
  agent_id:             Joi.number().integer().positive().allow(null).optional(),
  // ── Location coordinates ──────────────────────────────────────────────────
  lat:                  Joi.number().min(-90).max(90).allow(null).optional()
                          .description('Latitude (WGS 84). Null = no location set.'),
  lng:                  Joi.number().min(-180).max(180).allow(null).optional()
                          .description('Longitude (WGS 84). Null = no location set.'),
  show_exact_location:  Joi.boolean().default(false)
                          .description('If false, public site shows approximate circle only.'),
});

const updatePropertySchema = Joi.object({
  type_id:              Joi.number().integer().positive().optional(),
  type:                 Joi.string().trim().max(100).optional(),
  title:                Joi.string().trim().min(3).max(255).optional(),
  description:          Joi.string().trim().max(5000).allow('', null).optional(),
  location:             Joi.string().trim().max(200).optional(),
  address:              Joi.string().trim().max(500).optional(),
  area:                 Joi.number().positive().precision(2).optional(),
  rooms:                Joi.number().integer().min(0).max(99).allow(null).optional(),
  bedrooms:             Joi.number().integer().min(0).max(99).allow(null).optional(),
  bathrooms:            Joi.number().integer().min(0).max(99).allow(null).optional(),
  floor:                Joi.number().integer().min(-5).max(200).allow(null).optional(),
  price:                Joi.number().positive().precision(2).optional(),
  payment_method:       Joi.string().valid(...PAYMENT_METHODS).optional(),
  owner_name:           Joi.string().trim().max(150).optional(),
  owner_phone:          Joi.string().trim().max(30).optional(),
  listing_type:         Joi.string().valid(...LISTING_TYPES).optional(),
  is_featured:          Joi.boolean().optional(),
  agent_id:             Joi.number().integer().positive().allow(null).optional(),
  // ── Location coordinates ──────────────────────────────────────────────────
  lat:                  Joi.number().min(-90).max(90).allow(null).optional(),
  lng:                  Joi.number().min(-180).max(180).allow(null).optional(),
  show_exact_location:  Joi.boolean().optional(),
}).min(1);

const updateStatusSchema = Joi.object({
  status: Joi.string().valid(...PROPERTY_STATUSES).required(),
});

module.exports = { createPropertySchema, updatePropertySchema, updateStatusSchema };
