const PATHS = {
  USER: '/Users',
  DEVICE: '/Devices',
  SENSOR: '/Sensors',
  SENSOR_RESOURCES: '/resources',
};

const COLLECTIONS = {
  DEVICE: 'Device',
  SENSOR: 'Sensor',
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

module.exports = {
  PATHS,
  COLLECTIONS,
  METHODS,
  LOGIN_ROUTE,
};
