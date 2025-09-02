import Joi from 'joi';

// Device validation schemas
export const deviceSchema = Joi.object({
  deviceId: Joi.string().required().trim().min(3).max(50),
  ownerId: Joi.string().required().trim().min(3).max(50),
  name: Joi.string().required().trim().min(2).max(100),
  location: Joi.object({
    room: Joi.string().trim().max(50),
    floor: Joi.string().trim().max(10)
  }),
  outlets: Joi.array().items(Joi.object({
    id: Joi.string().valid('o1', 'o2', 'o3', 'o4', 'o5').required(),
    name: Joi.string().required().trim().min(2).max(100),
    type: Joi.string().valid('kitchen', 'safety').required(),
    status: Joi.boolean().default(false),
    powerConsumption: Joi.number().min(0).default(0)
  })),
  thresholds: Joi.object({
    temperature: Joi.object({
      min: Joi.number().min(-50).max(100),
      max: Joi.number().min(-50).max(100)
    }),
    humidity: Joi.object({
      min: Joi.number().min(0).max(100),
      max: Joi.number().min(0).max(100)
    }),
    smoke: Joi.object({
      max: Joi.number().min(0).max(10000)
    }),
    gas: Joi.object({
      max: Joi.number().min(0).max(10000)
    })
  })
});

export const deviceUpdateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  location: Joi.object({
    room: Joi.string().trim().max(50),
    floor: Joi.string().trim().max(10)
  }),
  outlets: Joi.array().items(Joi.object({
    id: Joi.string().valid('o1', 'o2', 'o3', 'o4', 'o5').required(),
    name: Joi.string().required().trim().min(2).max(100),
    type: Joi.string().valid('kitchen', 'safety').required(),
    status: Joi.boolean().default(false),
    powerConsumption: Joi.number().min(0).default(0)
  })),
  thresholds: Joi.object({
    temperature: Joi.object({
      min: Joi.number().min(-50).max(100),
      max: Joi.number().min(-50).max(100)
    }),
    humidity: Joi.object({
      min: Joi.number().min(0).max(100),
      max: Joi.number().min(0).max(100)
    }),
    smoke: Joi.object({
      max: Joi.number().min(0).max(10000)
    }),
    gas: Joi.object({
      max: Joi.number().min(0).max(10000)
    })
  })
});

// Device log validation schemas
export const deviceLogSchema = Joi.object({
  type: Joi.string().valid('telemetry', 'event', 'command', 'error').default('telemetry'),
  deviceId: Joi.string().required().trim().min(3).max(50),
  topic: Joi.string().required().trim().min(3).max(200),
  payload: Joi.object({
    ts: Joi.number().required(),
    temp: Joi.number().min(-50).max(150).required(),
    humid: Joi.number().min(0).max(100).required(),
    smoke: Joi.number().min(0).max(10000).required(),
    gas_ppm: Joi.number().min(0).max(10000).required(),
    o: Joi.object({
      o1: Joi.boolean().default(false),
      o2: Joi.boolean().default(false),
      o3: Joi.boolean().default(false),
      o4: Joi.boolean().default(false),
      o5: Joi.boolean().default(false)
    }).required()
  }).required(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').default('low'),
  metadata: Joi.object({
    source: Joi.string().trim().max(50),
    version: Joi.string().trim().max(20),
    ip: Joi.string().ip(),
    mac: Joi.string().pattern(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/)
  })
});

// Outlet toggle validation
export const outletToggleSchema = Joi.object({
  status: Joi.boolean().required()
});

// Threshold update validation
export const thresholdUpdateSchema = Joi.object({
  thresholds: Joi.object({
    temperature: Joi.object({
      min: Joi.number().min(-50).max(100),
      max: Joi.number().min(-50).max(100)
    }),
    humidity: Joi.object({
      min: Joi.number().min(0).max(100),
      max: Joi.number().min(0).max(100)
    }),
    smoke: Joi.object({
      max: Joi.number().min(0).max(10000)
    }),
    gas: Joi.object({
      max: Joi.number().min(0).max(10000)
    })
  }).required()
});

// Validation middleware
export const validateDevice = (req, res, next) => {
  const { error } = deviceSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      error: error.details[0].message
    });
  }
  next();
};

export const validateDeviceUpdate = (req, res, next) => {
  const { error } = deviceUpdateSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      error: error.details[0].message
    });
  }
  next();
};

export const validateDeviceLog = (req, res, next) => {
  const { error } = deviceLogSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      error: error.details[0].message
    });
  }
  next();
};

export const validateOutletToggle = (req, res, next) => {
  const { error } = outletToggleSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      error: error.details[0].message
    });
  }
  next();
};

export const validateThresholdUpdate = (req, res, next) => {
  const { error } = thresholdUpdateSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      error: error.details[0].message
    });
  }
  next();
};
