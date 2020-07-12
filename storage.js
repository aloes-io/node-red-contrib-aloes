const minimatch = require('minimatch');
const { COLLECTIONS, DEFAULT_STORAGE } = require('./constants');

const getGlobalStorageType = (settings, persistedStorage = 'file') => {
  const { contextStorage } = settings;
  return contextStorage && contextStorage[persistedStorage] ? persistedStorage : DEFAULT_STORAGE;
};

const getFromGlobalContext = (node, key, storageType = DEFAULT_STORAGE) => {
  return new Promise((resolve, reject) => {
    const globalContext = node.context().global;
    globalContext.get(key, storageType, (error, value) => (error ? reject(error) : resolve(value)));
  });
};

const getKeysFromGlobalContext = (node, globs, storageType = DEFAULT_STORAGE) => {
  return new Promise((resolve, reject) => {
    const globalContext = node.context().global;
    globalContext.keys(storageType, (error, keys) => {
      if (error) {
        reject(error);
      } else if (globs && globs.length) {
        const filteredKeys = keys.filter((key) => globs.some((glob) => minimatch(key, glob)));
        resolve(filteredKeys);
      } else {
        resolve(keys);
      }
    });
  });
};

const setToGlobalContext = (node, key, value, storageType = DEFAULT_STORAGE) => {
  return new Promise((resolve, reject) => {
    const globalContext = node.context().global;
    globalContext.set(key, value, storageType, (error) => (error ? reject(error) : resolve(value)));
  });
};

const getFromFlowContext = (node, key) => {
  return new Promise((resolve, reject) => {
    const flowContext = node.context().flow;
    flowContext.get(key, (error, value) => (error ? reject(error) : resolve(value)));
  });
};

const getKeysFromFlowContext = (node, globs) => {
  return new Promise((resolve, reject) => {
    const flowContext = node.context().flow;
    flowContext.keys((error, keys) => {
      if (error) {
        reject(error);
      } else if (globs && globs.length) {
        const filteredKeys = keys.filter((key) => globs.some((glob) => minimatch(key, glob)));
        resolve(filteredKeys);
      } else {
        resolve(keys);
      }
    });
  });
};

const setToFlowContext = (node, key, value) => {
  return new Promise((resolve, reject) => {
    const flowContext = node.context().flow;
    flowContext.set(key, value, (error) => (error ? reject(error) : resolve(value)));
  });
};

const saveInstance = {
  [COLLECTIONS.DEVICE.toLowerCase()]: async (
    node,
    storageKey,
    payload,
    storageType = DEFAULT_STORAGE,
  ) => setToGlobalContext(node, `device-${storageKey}`, payload, storageType),
  [COLLECTIONS.SENSOR.toLowerCase()]: async (
    node,
    storageKey,
    payload,
    storageType = DEFAULT_STORAGE,
  ) => setToGlobalContext(node, `sensor-${storageKey}`, payload, storageType),
  [COLLECTIONS.MEASUREMENT.toLowerCase()]: async (
    node,
    storageKey,
    payload,
    storageType = DEFAULT_STORAGE,
  ) => null,
};

function setStorageKey(msg) {
  const { collection, deviceName, instanceProperty, nativeNodeId, nativeSensorId } = msg;
  switch (collection) {
    case COLLECTIONS.DEVICE:
      return `device-${deviceName}`;
    case COLLECTIONS.SENSOR:
      return `sensor-${deviceName}-${instanceProperty}-${nativeNodeId}-${nativeSensorId}`;
    case COLLECTIONS.MEASUREMENT:
      return `measurement-${deviceName}-${instanceProperty}-${nativeNodeId}-${nativeSensorId}`;
    default:
      return null;
  }
}

module.exports = {
  getFromGlobalContext,
  getFromFlowContext,
  getGlobalStorageType,
  getKeysFromGlobalContext,
  getKeysFromFlowContext,
  saveInstance,
  setStorageKey,
  setToGlobalContext,
  setToFlowContext,
};
