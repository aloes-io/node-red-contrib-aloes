module.exports = function (RED) {
  const { COLLECTIONS } = require('../constants');
  const { isValidCollection, isValidMethod, isValidTopic } = require('../validators');

  function SetInternalTopic(config) {
    RED.nodes.createNode(this, config);

    this.aloesNetwork = config.aloesNetwork;
    this.aloesConn = RED.nodes.getNode(this.aloesNetwork);

    const node = this;
    const {
      collection,
      method,
      useTopic,
      topic,
      instanceProperty,
      nativeNodeId,
      nativeSensorId,
      resource,
    } = config;

    function inputsValid(msg) {
      const { collection, method, instanceProperty, topic } = msg;
      if ((!useTopic && (!collection || !method || !instanceProperty)) || (useTopic && !topic)) {
        node.error(RED._('aloes.errors.missing-input'));
        return false;
      } else if (!useTopic && collection && !isValidCollection(collection)) {
        node.error(RED._('aloes.errors.invalid-collection'));
        return false;
      } else if (!useTopic && method && !isValidMethod(method)) {
        node.error(RED._('aloes.errors.invalid-method'));
        return false;
      } else if (useTopic && topic && !isValidTopic(topic)) {
        node.error(RED._('aloes.errors.invalid-topic'));
        return false;
      }
      return true;
    }

    function setTopic(msg) {
      const userId = node.aloesConn.userId;
      const { collection, method, instanceProperty } = msg;
      let topic = `${userId}/${collection}/${method}/${instanceProperty}`;
      if (collection !== COLLECTIONS.DEVICE) {
        topic += `/${msg.nativeNodeId}/${msg.nativeSensorId}/${msg.resource}`;
      }
      if (!isValidTopic) {
        node.error(RED._('aloes.errors.invalid-topic'));
        return null;
      }
      return topic;
    }

    node.on('input', function (msg, send, done) {
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
        if (method) {
          msg.method = method;
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
        if (resource) {
          msg.resource = resource;
        }

        if (!inputsValid(msg)) {
          done();
          return;
        }

        if (useTopic && msg.topic) {
          const parts = msg.topic.split('/');
          msg.collection = parts[1];
          msg.method = parts[2];
          msg.instanceProperty = parts[3];
          if (msg.collection === COLLECTIONS.SENSOR) {
            msg.nativeNodeId = parts[4];
            msg.nativeSensorId = parts[5];
            msg.resource = parts[6];
          }
        }

        msg.topic = setTopic(msg);
        if (msg.topic) {
          send(msg);
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
  RED.nodes.registerType('set-internal-topic', SetInternalTopic);
};
