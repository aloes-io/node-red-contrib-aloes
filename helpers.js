const { COLLECTIONS, METHODS } = require('./constants');

const getFromGlobalContext = (node, key) => {
  return new Promise((resolve, reject) => {
    const globalContext = node.context().global;
    globalContext.get(key, (error, res) => {
      if (error) {
        reject(error);
      } else {
        resolve(res);
      }
    });
  });
};

const setToGlobalContext = (node, key, value) => {
  return new Promise((resolve, reject) => {
    const globalContext = node.context().global;
    globalContext.set(key, value, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
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

const getDeviceName = (device) => device.name.toLowerCase();

const getSensorName = (sensor) =>
  `${sensor.name.toLowerCase()}-${sensor.type}-${sensor.nativeNodeId || 0}-${
    sensor.nativeSensorId
  }`;

const getMeasurementName = (measurement) =>
  `${measurement.type}-${measurement.sensorNodeId || 0}-${measurement.nativeSensorId}`;

const getInstanceName = {
  device: (device) => getDeviceName(device),
  sensor: (sensor) => getSensorName(sensor),
  measurement: (measurement) => getMeasurementName(measurement),
};

const sendTo = {
  device: (send, message) => send([message, null, null]),
  sensor: (send, message) => send([null, message, null]),
  measurement: (send, message) => send([null, null, message]),
};

const saveInstance = {
  device: async (deviceName, device) => setToGlobalContext(node, `device-${deviceName}`, device),
  sensor: async (sensorName, sensor) => setToGlobalContext(node, `sensor-${sensorName}`, sensor),
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
