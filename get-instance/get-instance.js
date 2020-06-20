module.exports = function (RED) {
  const { COLLECTIONS } = require('../constants');
  const { getFromGlobalContext, isValidCollection, isValidTopic, sendTo } = require('../helpers');

  function GetInstance(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    const {
      deviceName,
      collection,
      useTopic,
      topic,
      sensorType,
      nativeNodeId,
      nativeSensorId,
    } = config;

    function inputsValid(msg) {
      if ((!useTopic && !msg.collection) || (useTopic && !msg.topic)) {
        node.error(RED._('aloes.errors.missing-input'));
        return false;
      } else if (msg.collection && !isValidCollection(msg.collection)) {
        node.error(RED._('aloes.errors.invalid-collection'));
        return false;
      } else if (msg.topic && !isValidTopic(msg.topic)) {
        node.error(RED._('aloes.errors.invalid-topic'));
        return false;
      }
      return true;
    }

    function setStorageKey(msg) {
      switch (msg.collection) {
        case COLLECTIONS.DEVICE:
          return `device-${deviceName}`;
        case COLLECTIONS.SENSOR:
          return `sensor-${deviceName}-${msg.sensorType}-${msg.nativeNodeId}-${msg.nativeSensorId}`;
        case COLLECTIONS.MEASUREMENT:
          return `measurement-${deviceName}-${msg.sensorType}-${msg.nativeNodeId}-${msg.nativeSensorId}`;
        default:
          return null;
      }
    }
    node.on('input', async function (msg, send, done) {
      try {
        send =
          send ||
          function () {
            node.send.apply(node, arguments);
          };

        // console.log({ deviceName, config, msg });

        if (topic) {
          msg.topic = topic;
        }
        if (collection) {
          msg.collection = collection;
        }
        if (sensorType) {
          msg.sensorType = sensorType;
        }
        if (nativeNodeId) {
          msg.nativeNodeId = nativeNodeId;
        }
        if (nativeSensorId) {
          msg.nativeSensorId = nativeSensorId;
        }

        if (!inputsValid(msg)) {
          done();
          return;
        }
        if (useTopic && msg.topic) {
          const parts = msg.topic.split('/');
          msg.collection = parts[1];
          if (msg.collection === COLLECTIONS.SENSOR) {
            msg.sensorType = parts[3];
            msg.nativeNodeId = parts[4];
            msg.nativeSensorId = parts[5];
          }
        }
        const type = msg.collection.toLowerCase();
        const storageKey = setStorageKey(msg);
        const instance = await getFromGlobalContext(node, storageKey);
        if (instance) {
          msg.payload = instance;
          sendTo[type](send, msg);
        } else {
          node.error(RED._('aloes.errors.not-found'));
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
      }
    });
  }
  RED.nodes.registerType('get-instance', GetInstance);
};
