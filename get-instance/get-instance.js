module.exports = function (RED) {
  const { COLLECTIONS } = require('../constants');
  const { sendTo } = require('../helpers');
  const {
    getFromGlobalContext,
    getGlobalStorageType,
    getKeysFromGlobalContext,
    setStorageKey,
  } = require('../storage');
  const { isValidCollection, isValidTopic } = require('../validators');

  const { settings } = RED;

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
    const storageType = getGlobalStorageType(settings);

    function inputsValid(msg) {
      if (!getMany && ((!useTopic && !msg.collection) || (useTopic && !msg.topic))) {
        node.error(RED._('aloes.errors.missing-input'));
        return false;
      } else if (!useTopic && msg.collection && !isValidCollection(msg.collection)) {
        node.error(RED._('aloes.errors.invalid-collection'));
        return false;
      } else if (useTopic && msg.topic && !isValidTopic(msg.topic)) {
        node.error(RED._('aloes.errors.invalid-topic'));
        return false;
      }
      return true;
    }

    function setGlobs(msg) {
      let glob = '';
      if (msg.collection && deviceName) {
        glob = `${msg.collection.toLowerCase()}-${deviceName}`;
        return [glob, `${glob}-*`];
      } else if (msg.collection && !deviceName) {
        glob = msg.collection.toLowerCase();
        return [`${glob}-*`];
      } else if (!msg.collection && deviceName) {
        glob = `*-${deviceName}`;
        return [glob, `${glob}-*`];
      }
      return ['*'];
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

    async function getManyInstances(msg, send) {
      const globs = setGlobs(msg);
      const keys = await getKeysFromGlobalContext(node, globs, storageType);
      const instances = await Promise.all(
        keys.map(async (key) => {
          try {
            const payload = await getFromGlobalContext(node, key, storageType);
            if (!payload) {
              return null;
            }
            const collection = getCollection(key);
            const type = collection.toLowerCase();
            const instanceName = getInstanceName[type](payload);
            const message = { ...msg, collection, instanceName, payload };
            sendTo[type](send, message);
            return message;
          } catch (error) {
            return null;
          }
        }),
      );
      // if (!instances) {
      //   node.error(RED._('aloes.errors.not-found'));
      // }
      return instances;
    }

    async function getOneInstance(msg, send) {
      const type = msg.collection.toLowerCase();
      const storageKey = setStorageKey(msg);
      const payload = await getFromGlobalContext(node, storageKey, storageType);
      if (payload) {
        const message = {
          ...msg,
          collection: msg.collection,
          instanceName: getInstanceName[type](payload),
          payload,
        };
        sendTo[type](send, message);
        return payload;
      }
      // node.error(RED._('aloes.errors.not-found'));
      return null;
    }

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
          await getManyInstances(msg, send);
        } else {
          await getOneInstance(msg, send);
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
