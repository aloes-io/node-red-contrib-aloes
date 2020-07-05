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

const HTTP_APIS = {
  rest: 'rest',
  graph: 'graph',
};

const DEVICES_LIST = 'devicesList';

const DEVICES_SELECTION = 'devicesSelection';

module.exports = {
  COLLECTIONS,
  CONNECTION_TYPES,
  DEVICES_LIST,
  DEVICES_SELECTION,
  HTTP_APIS,
  METHODS,
  LOGIN_ROUTE,
  PATHS,
};
