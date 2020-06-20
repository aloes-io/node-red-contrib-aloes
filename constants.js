const PATHS = {
  USER: '/Users',
  DEVICE: '/Devices',
  SENSOR: '/Sensors',
  SENSOR_RESOURCES: '/resources',
};

const COLLECTIONS = {
  DEVICE: 'Device',
  SENSOR: 'Sensor',
  MEASUREMENT: 'Measurement',
};

const METHODS = {
  HEAD: 'HEAD',
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  STREAM: 'STREAM',
};

const LOGIN_ROUTE = `${PATHS.USER}/login`;

const CONNECTION_TYPES = {
  http: 'http',
  mqtt: 'mqtt',
};

module.exports = {
  COLLECTIONS,
  CONNECTION_TYPES,
  METHODS,
  LOGIN_ROUTE,
  PATHS,
};
