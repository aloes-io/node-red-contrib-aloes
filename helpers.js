const { COLLECTIONS, METHODS } = require('./constants');

const getFromGlobalContext = (node, key) => {
  // todo get storage type from env ?
  return new Promise((resolve, reject) => {
    const globalContext = node.context().global;
    globalContext.get(key, (error, value) => (error ? reject(error) : resolve(value)));
  });
};

const setToGlobalContext = (node, key, value) => {
  // todo get storage type from env ?
  return new Promise((resolve, reject) => {
    const globalContext = node.context().global;
    globalContext.set(key, value, (error) => (error ? reject(error) : resolve(value)));
  });
};

const isValidCollection = (collection) => Object.values(COLLECTIONS).includes(collection);

const isValidMethod = (method) => Object.values(METHODS).includes(method);

const getAloesTopic = ({ userId, method, collection, instanceId = null }) => {
  if (isValidCollection(collection) && isValidMethod(method)) {
    return instanceId
      ? `${userId}/${collection}/${method}/${instanceId}`
      : `${userId}/${collection}/${method}}`;
  }
  return null;
};

const getDeviceName = (device) => device.name.replace(' ', '-').toLowerCase();

const getSensorName = (sensor) =>
  `${sensor.type}-${sensor.nativeNodeId || 0}-${sensor.nativeSensorId}`;

const getMeasurementName = (measurement) =>
  `${measurement.type}-${measurement.sensorNodeId || 0}-${measurement.nativeSensorId}`;

const getInstanceName = {
  [COLLECTIONS.DEVICE.toLowerCase()]: (device) => getDeviceName(device),
  [COLLECTIONS.SENSOR.toLowerCase()]: (sensor) => getSensorName(sensor),
  [COLLECTIONS.MEASUREMENT.toLowerCase()]: (measurement) => getMeasurementName(measurement),
};

const sendTo = {
  [COLLECTIONS.DEVICE.toLowerCase()]: (send, message) => send([message, null, null]),
  [COLLECTIONS.SENSOR.toLowerCase()]: (send, message) => send([null, message, null]),
  [COLLECTIONS.MEASUREMENT.toLowerCase()]: (send, message) => send([null, null, message]),
};

const saveInstance = {
  [COLLECTIONS.DEVICE.toLowerCase()]: async (node, storageKey, device) =>
    setToGlobalContext(node, `device-${storageKey}`, device),
  [COLLECTIONS.SENSOR.toLowerCase()]: async (node, storageKey, sensor) =>
    setToGlobalContext(node, `sensor-${storageKey}`, sensor),
  [COLLECTIONS.MEASUREMENT.toLowerCase()]: async (node, storageKey, measurement) => null,
};

module.exports = {
  getFromGlobalContext,
  getAloesTopic,
  getDeviceName,
  getSensorName,
  getInstanceName,
  isValidCollection,
  isValidMethod,
  saveInstance,
  sendTo,
  setToGlobalContext,
};
