const Ajv = require('ajv');
const { omaObjects } = require('oma-json');
const { COLLECTIONS, METHODS } = require('./constants');

const ajv = new Ajv({ removeAdditional: true });

const deviceSchema = {
  additionalProperties: false,
  properties: {
    accessPointUrl: { type: ['null', 'string'] },
    apiKey: { type: 'string' },
    clientKey: { type: ['null', 'string'] },
    createdAt: { type: ['null', 'string'] },
    description: { type: ['null', 'string'] },
    devEui: { type: 'string' },
    frameCounter: { type: 'number' },
    icons: { type: 'array', items: { type: 'string' } },
    id: { type: 'string' },
    lastSignal: { type: 'string' },
    messageProtocol: { type: 'string' },
    messageProtocolVersion: { type: ['null', 'string'] },
    name: { type: 'string' },
    ownerId: { type: 'string' },
    status: { type: 'boolean' },
    transportProtocol: { type: 'string' },
    transportProtocolVersion: { type: ['null', 'string'] },
    type: { type: 'string' },
  },
  required: [
    'accessPointUrl',
    'apiKey',
    'devEui',
    'frameCounter',
    'icons',
    'id',
    'lastSignal',
    'messageProtocol',
    'name',
    'ownerId',
    'status',
    'transportProtocol',
    'type',
  ],
};

function validateOmaObject(schema, resources, parentSchema, currentPath, sensor) {
  if (!resources) {
    return true;
  }
  const { type } = sensor;
  const omaObject = omaObjects.find(({ value }) => value === type);
  if (!omaObject) {
    return false;
  }

  for (let key in omaObject.resources) {
    if (!resources.hasOwnProperty(key)) {
      resources[key] = omaObject.resources[key];
    }
  }

  return true;
}

ajv.addKeyword('isValidResources', {
  validate: validateOmaObject,
  errors: false,
});

const sensorSchema = {
  additionalProperties: false,
  properties: {
    description: { type: ['null', 'string'] },
    devEui: { type: 'string' },
    deviceId: { type: 'string' },
    frameCounter: { type: 'number' },
    icons: { type: 'array' },
    id: { type: 'string' },
    inPrefix: { type: ['null', 'string'] },
    lastSignal: { type: ['null', 'string'] },
    messageProtocol: { type: 'string' },
    messageProtocolVersion: { type: ['null', 'string'] },
    method: { type: 'string' },
    name: { type: 'string' },
    nativeNodeId: { type: ['null', 'string'] },
    nativeSensorId: { type: 'string' },
    nativeResource: { type: ['number', 'string'] },
    nativeType: { type: ['number', 'string'] },
    outPrefix: { type: ['null', 'string'] },
    ownerId: { type: 'string' },
    resource: { type: 'number' },
    transportProtocol: { type: 'string' },
    transportProtocolVersion: { type: ['null', 'string'] },
    type: { type: 'number' },
    resources: {
      type: ['null', 'object'],
      isValidResources: {},
      additionalProperties: true,
    },
  },
  required: [
    'devEui',
    'deviceId',
    'frameCounter',
    'icons',
    'id',
    'lastSignal',
    'messageProtocol',
    'name',
    'nativeNodeId',
    'nativeResource',
    'nativeSensorId',
    'nativeType',
    'ownerId',
    'transportProtocol',
    'type',
  ],
};

const isValidCollection = (collection) => Object.values(COLLECTIONS).includes(collection);

const isValidMethod = (method) => Object.values(METHODS).includes(method);

const isValidTopic = (topic) => {
  const parts = topic.split('/');
  const [, collection, method] = parts;
  if (!collection || !method) {
    return false;
  }
  if (!isValidCollection(collection) || !isValidMethod(method)) {
    return false;
  }
  if (collection === COLLECTIONS.DEVICE && parts.length < 4) {
    return false;
  }
  if (collection === COLLECTIONS.SENSOR && parts.length < 6) {
    return false;
  }
  return true;
};

function matchTopic(ts, t) {
  if (ts === '#') {
    return true;
  } else if (ts.startsWith('$share')) {
    /* The following allows shared subscriptions (as in MQTT v5)
    http://docs.oasis-open.org/mqtt/mqtt/v5.0/cs02/mqtt-v5.0-cs02.html#_Toc514345522
    4.8.2 describes shares like:
    $share/{ShareName}/{filter}
    $share is a literal string that marks the Topic Filter as being a Shared Subscription Topic Filter.
    {ShareName} is a character string that does not include "/", "+" or "#"
    {filter} The remainder of the string has the same syntax and semantics as a Topic Filter in a non-shared subscription. Refer to section 4.7.
  */
    ts = ts.replace(/^\$share\/[^#+/]+\/(.*)/g, '$1');
  }
  const re = new RegExp(
    '^' +
      ts
        .replace(/([\[\]\?\(\)\\\\$\^\*\.|])/g, '\\$1')
        .replace(/\+/g, '[^/]+')
        .replace(/\/#$/, '(/.*)?') +
      '$',
  );
  return re.test(t);
}

const validateDevice = (device) => {
  const validate = ajv.compile(deviceSchema);
  const isValid = validate(device);
  return { isValid, device };
};

const validateSensor = (sensor) => {
  const validate = ajv.compile(sensorSchema);
  const isValid = validate(sensor);
  return { isValid, sensor };
};

const validateInstance = {
  device: (device) => validateDevice(device),
  sensor: (sensor) => validateSensor(sensor),
  measurement: (measurement) => ({ isValid: true, measurement }),
};

module.exports = {
  isValidCollection,
  isValidMethod,
  isValidTopic,
  matchTopic,
  validateInstance,
  validateDevice,
  validateSensor,
};
