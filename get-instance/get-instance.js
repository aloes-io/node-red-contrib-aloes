module.exports = function (RED) {
  const { COLLECTIONS } = require('../constants');
  const {
    getFromGlobalContext,
    getInstanceName,
    getKeysFromGlobalContext,
    isValidCollection,
    isValidTopic,
    sendTo,
  } = require('../helpers');

  function GetInstance(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    const {
      deviceName,
      collection,
      useTopic,
      getMany,
      topic,
      instanceProperty,
      nativeNodeId,
      nativeSensorId,
    } = config;

    function inputsValid(msg) {
      if (!getMany && ((!useTopic && !msg.collection) || (useTopic && !msg.topic))) {
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
          return `sensor-${deviceName}-${msg.instanceProperty}-${msg.nativeNodeId}-${msg.nativeSensorId}`;
        case COLLECTIONS.MEASUREMENT:
          return `measurement-${deviceName}-${msg.instanceProperty}-${msg.nativeNodeId}-${msg.nativeSensorId}`;
        default:
          return null;
      }
    }

    function setGlobs(msg) {
      let glob = '';
      if (msg.collection) {
        glob += msg.collection.toLowerCase();
      }
      if (deviceName) {
        if (!glob) {
          glob += `*-${deviceName}`;
        } else {
          glob += `-${deviceName}`;
        }
      }
      return [glob, `${glob}-*`];
    }

    function getCollection(key) {
      let collection;
      for (prop in COLLECTIONS) {
        const refCollection = COLLECTIONS[prop];
        if (key.startsWith(refCollection.toLowerCase())) {
          collection = refCollection;
          break;
        }
      }
      return collection;
    }

    node.on('input', async function (msg, send, done) {
      try {
        send =
          send ||
          function () {
            node.send.apply(node, arguments);
          };

        if (topic) {
          msg.topic = topic;
        }
        if (collection) {
          msg.collection = collection;
        }
        if (instanceProperty) {
          msg.instanceProperty = instanceProperty;
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
            msg.instanceProperty = parts[3];
            msg.nativeNodeId = parts[4];
            msg.nativeSensorId = parts[5];
          }
        }

        if (getMany) {
          const globs = setGlobs(msg);
          const keys = await getKeysFromGlobalContext(node, globs);

          const instances = await Promise.all(
            keys.map(async (key) => {
              try {
                const payload = await getFromGlobalContext(node, key);
                if (!payload) {
                  return null;
                }
                const collection = getCollection(key);
                const type = collection.toLowerCase();
                const instanceName = getInstanceName[type](payload);
                const message = { collection, instanceName, payload };
                sendTo[type](send, message);
                return message;
              } catch (error) {
                return null;
              }
            }),
          );

          if (!instances) {
            node.error(RED._('aloes.errors.not-found'));
          }
        } else {
          const type = msg.collection.toLowerCase();
          const storageKey = setStorageKey(msg);
          const payload = await getFromGlobalContext(node, storageKey);
          if (payload) {
            const message = {
              collection: msg.collection,
              instanceName: getInstanceName[type](payload),
              payload,
            };
            sendTo[type](send, message);
          } else {
            node.error(RED._('aloes.errors.not-found'));
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
      }
    });
  }
  RED.nodes.registerType('get-instance', GetInstance);
};
