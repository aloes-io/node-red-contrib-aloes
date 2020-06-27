module.exports = function (RED) {
  const { COLLECTIONS } = require('../constants');
  const {
    getInstanceName,
    isValidCollection,
    isValidMethod,
    saveInstance,
    sendTo,
    setToGlobalContext,
    getFromGlobalContext,
  } = require('../helpers');

  function SetInstance(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    const { deviceId, deviceName, saveInstances } = config;

    function inputsValid(msg) {
      if (!msg.collection) {
        node.error(RED._('aloes.errors.missing-collection'));
        return false;
      } else if (!isValidCollection(msg.collection)) {
        node.error(RED._('aloes.errors.invalid-collection'));
        return false;
      } else if (!isValidMethod(msg.method)) {
        node.error(RED._('aloes.errors.invalid-method'));
        return false;
      }
      return true;
    }

    const extractDeviceId = (msg) => {
      switch (msg.collection) {
        case COLLECTIONS.DEVICE:
          if (msg.payload.status) {
            node.status({ fill: 'green', shape: 'ring', text: 'online' });
          } else {
            node.status({ fill: 'yellow', shape: 'dot', text: 'offline' });
          }
          return msg.payload.id.toString();
        case COLLECTIONS.SENSOR:
          return msg.payload.deviceId.toString();
        case COLLECTIONS.MEASUREMENT:
          return msg.payload.deviceId.toString();
        default:
          return null;
      }
    };

    const setStorageKey = (msg, type) => {
      let storageKey = msg.instanceName || getInstanceName[type](msg.payload);
      if (msg.collection !== COLLECTIONS.DEVICE) {
        storageKey = `${deviceName}-${storageKey}`;
      }
      return storageKey;
    };

    const addToDevicesList = async () => {
      const devicesList = (await getFromGlobalContext(node, 'devicesList')) || [];
      const index = devicesList.indexOf(deviceName);
      if (index === -1) {
        devicesList.push(deviceName);
        await setToGlobalContext(node, 'devicesList', devicesList);
      }
    };

    const removeFromDevicesList = async () => {
      const devicesList = (await getFromGlobalContext(node, 'devicesList')) || [];
      const index = devicesList.indexOf(deviceName);
      if (index === -1) {
        devicesList.splice(index, 1);
        await setToGlobalContext(node, 'devicesList', devicesList);
      }
    };

    addToDevicesList();

    node.on('input', async function (msg, send, done) {
      try {
        send =
          send ||
          function () {
            node.send.apply(node, arguments);
          };

        if (!inputsValid(msg)) {
          done();
          return;
        }

        const incomingDeviceId = extractDeviceId(msg);

        if (incomingDeviceId && deviceId === incomingDeviceId) {
          const type = msg.collection.toLowerCase();
          const storageKey = setStorageKey(msg, type);
          if (saveInstances) {
            await saveInstance[type](node, storageKey, msg.payload);
          }
          sendTo[type](send, msg);
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
