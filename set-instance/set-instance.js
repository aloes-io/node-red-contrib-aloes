module.exports = function (RED) {
  const { COLLECTIONS, DEVICES_LIST } = require('../constants');
  const { getInstanceName, sendTo } = require('../helpers');
  const {
    getFromGlobalContext,
    getGlobalStorageType,
    saveInstance,
    setToGlobalContext,
  } = require('../storage');
  const { isValidCollection, isValidMethod, validateInstance } = require('../validators');

  const { settings } = RED;

  function SetInstance(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    const { deviceId, deviceName, saveInstances } = config;
    const storageType = getGlobalStorageType(settings);

    function inputsValid(msg) {
      const { collection, deviceName, method } = msg;
      if (!collection) {
        node.error(RED._('aloes.errors.missing-collection'));
        return false;
      } else if (!deviceName) {
        node.error(RED._('aloes.errors.missing-device-name'));
        return false;
      } else if (!isValidCollection(collection)) {
        node.error(RED._('aloes.errors.invalid-collection'));
        return false;
      } else if (!isValidMethod(method)) {
        node.error(RED._('aloes.errors.invalid-method'));
        return false;
      }
      return true;
    }

    const extractDeviceId = (msg) => {
      switch (msg.collection) {
        case COLLECTIONS.DEVICE:
          return msg.payload && msg.payload.id ? msg.payload.id.toString() : null;
        case COLLECTIONS.SENSOR:
          return msg.payload && msg.payload.deviceId ? msg.payload.deviceId.toString() : null;
        case COLLECTIONS.MEASUREMENT:
          return msg.payload && msg.payload.deviceId ? msg.payload.deviceId.toString() : null;
        default:
          return null;
      }
    };

    const setStorageKey = (msg, type) => {
      let storageKey = msg.instanceName || getInstanceName[type](msg.payload);
      if (msg.collection.toLowerCase() !== COLLECTIONS.DEVICE.toLowerCase()) {
        storageKey = `${deviceName}-${storageKey}`;
      }
      return `${msg.collection.toLowerCase()}-${storageKey}`;
    };

    const addToDevicesList = async () => {
      const devicesList = (await getFromGlobalContext(node, DEVICES_LIST, storageType)) || [];
      const index = devicesList.indexOf(deviceName);
      if (index === -1) {
        devicesList.push(deviceName);
        await setToGlobalContext(node, DEVICES_LIST, devicesList);
      }
    };

    const removeFromDevicesList = async () => {
      const devicesList = (await getFromGlobalContext(node, DEVICES_LIST, storageType)) || [];
      const index = devicesList.indexOf(deviceName);
      if (index === -1) {
        devicesList.splice(index, 1);
        await setToGlobalContext(node, DEVICES_LIST, devicesList, storageType);
      }
    };

    node.status({ fill: 'yellow', shape: 'dot', text: 'offline' });

    addToDevicesList();

    node.on('input', async function (msg, send, done) {
      try {
        send =
          send ||
          function () {
            node.send.apply(node, arguments);
          };

        if (deviceName) {
          msg.deviceName = deviceName;
        }

        if (!inputsValid(msg)) {
          done();
          return;
        }

        const incomingDeviceId = extractDeviceId(msg);

        if (incomingDeviceId && deviceId === incomingDeviceId) {
          if (msg.collection === COLLECTIONS.DEVICE) {
            if (msg.payload.status) {
              node.status({ fill: 'green', shape: 'ring', text: 'online' });
            } else {
              node.status({ fill: 'yellow', shape: 'dot', text: 'offline' });
            }
          }
          const type = msg.collection.toLowerCase();
          const storageKey = setStorageKey(msg, type);

          const { [type]: updatedPayload, isValid } = validateInstance[type](msg.payload);
          if (isValid) {
            msg.payload = updatedPayload;
            if (saveInstances) {
              await saveInstance[type](node, storageKey, msg.payload, storageType);
            }
            sendTo[type](send, msg);
          } else {
            // console.log({ updatedPayload });
            node.error(`${type} instance #${updatedPayload.id} is not valid`);
          }
        }

        if (done) {
          done();
        }
      } catch (error) {
        if (done) {
          done(error);
        } else {
          node.error(error, msg);
        }

        node.status({ fill: 'red', shape: 'ring', text: error.message || 'error' });
      }
    });

    node.on('close', function (removed, done) {
      removeFromDevicesList()
        .then(() => {
          done();
        })
        .catch((e) => {
          done(e);
        });
    });
  }
  RED.nodes.registerType('set-instance', SetInstance);
};
