module.exports = function (RED) {
  const { aloesClientEncoder } = require('aloes-handlers');
  const { isValidCollection, isValidMethod, isValidTopic } = require('../helpers');

  function SetAloesTopic(config) {
    RED.nodes.createNode(this, config);

    this.aloesNetwork = config.aloesNetwork;
    this.aloesConn = RED.nodes.getNode(this.aloesNetwork);

    const node = this;
    const { collection, method, useTopic, topic } = config;

    function inputsValid(msg) {
      const { collection, method, topic, payload } = msg;
      if (
        (!useTopic && (!collection || !method)) ||
        (useTopic && !topic) ||
        !payload ||
        !payload.id
      ) {
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
      const { collection, method, modelId } = msg;
      const { topic } = aloesClientEncoder({
        pattern: 'aloesclient',
        collection,
        method,
        modelId,
        userId,
      });
      if (!topic) {
        node.error(RED._('aloes.errors.invalid-topic'));
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

        if (!inputsValid(msg)) {
          done();
          return;
        }

        msg.modelId = msg.payload.id;

        if (useTopic && msg.topic) {
          const parts = msg.topic.split('/');
          msg.collection = parts[1];
          msg.method = parts[2];
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
  RED.nodes.registerType('set-aloes-topic', SetAloesTopic);
};
