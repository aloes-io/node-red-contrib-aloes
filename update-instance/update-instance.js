module.exports = function (RED) {
  const { updateAloesSensors } = require('aloes-handlers');
  const { COLLECTIONS } = require('../constants');
  const { getInstanceName, sendTo } = require('../helpers');
  const {
    getFromGlobalContext,
    getGlobalStorageType,
    setStorageKey,
    saveInstance,
  } = require('../storage');
  const { isValidCollection, isValidTopic, validateInstance } = require('../validators');

  const { settings } = RED;

  function UpdateInstance(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    const {
      deviceName,
      key,
      payload,
      useTopic,
      topic,
      collection,
      instanceProperty,
      nativeNodeId,
      nativeSensorId,
      saveInstances,
    } = config;
    const storageType = getGlobalStorageType(settings);

    function inputsValid(msg) {
      const { deviceName, collection, topic, key, payload } = msg;
      if (
        (!useTopic && !collection) ||
        (useTopic && !topic) ||
        key === undefined ||
        key === null ||
        payload === undefined ||
        !deviceName
      ) {
        node.error(RED._('aloes.errors.missing-input'));
        return false;
      } else if (!useTopic && collection && !isValidCollection(collection)) {
        node.error(RED._('aloes.errors.invalid-collection'));
        return false;
      } else if (useTopic && topic && !isValidTopic(topic)) {
        node.error(RED._('aloes.errors.invalid-topic'));
        return false;
      }
      return true;
    }

    async function getOneInstance(msg) {
      const type = msg.collection.toLowerCase();
      const storageKey = setStorageKey(msg);
      const instance = await getFromGlobalContext(node, storageKey, storageType);
      if (instance) {
        return {
          type,
          instanceName: getInstanceName[type](instance),
          instance,
        };
      }
      return {};
    }

    const updateInstance = (msg, instance) => {
      try {
        let payload;
        switch (msg.collection) {
          case COLLECTIONS.DEVICE:
            if (instance[msg.key] === undefined) {
              node.error(RED._('aloes.errors.invalid-key'));
              return null;
            }
            instance[msg.key] = msg.payload;
            payload = instance;
            break;
          case COLLECTIONS.SENSOR:
            if (typeof msg.key === 'string' && isNaN(Number(msg.key))) {
              node.error(RED._('aloes.errors.invalid-key'));
              return null;
            }
            const sensor = updateAloesSensors(instance, Number(msg.key), msg.payload);
            if (!sensor || sensor === null) {
              node.error(RED._('aloes.errors.invalid-sensor'));
              return null;
            }
            // sensor.method = msg.method;
            // sensor.value = msg.payload;
            sensor.lastSignal = new Date();
            payload = sensor;
            break;
          case COLLECTIONS.MEASUREMENT:
            break;
        }
        return payload;
      } catch (error) {
        return null;
      }
    };

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

        if (key) {
          msg.key = key;
        }
        if (payload) {
          msg.payload = payload;
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

        if (useTopic && msg.topic) {
          const parts = msg.topic.split('/');
          msg.collection = parts[1];
          msg.method = parts[2];
          if (msg.collection === COLLECTIONS.SENSOR) {
            msg.instanceProperty = parts[3];
            msg.nativeNodeId = parts[4];
            msg.nativeSensorId = parts[5];
            msg.key = parts[6];
          } else if (msg.collection === COLLECTIONS.DEVICE) {
            msg.instanceProperty = parts[3];
            msg.key = parts[3];
          }
        }

        if (!inputsValid(msg)) {
          done();
          return;
        }

        const { instance, instanceName, type } = await getOneInstance(msg);
        if (instance) {
          const payload = updateInstance(msg, instance);

          const { [type]: updatedPayload, isValid } = validateInstance[type](payload);
          if (isValid) {
            msg.payload = updatedPayload;
            msg.instanceName = instanceName;
            const storageKey = setStorageKey(msg, type);
            if (saveInstances) {
              await saveInstance[type](node, storageKey, msg.payload, storageType);
            }
            sendTo[type](send, msg);
          } else {
            node.error(`${type} instance #${updatedPayload.id} is not valid`);
          }
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

        node.status({ fill: 'red', shape: 'ring', text: error.message || 'error' });
      }
    });
  }
  RED.nodes.registerType('update-instance', UpdateInstance);
};
