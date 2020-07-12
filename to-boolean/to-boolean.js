module.exports = function (RED) {
  const { isValidTopic } = require('../validators');

  function ToBoolean(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    const { useTopic, topic, resource } = config;

    function inputsValid(msg) {
      const { payload, resource, topic } = msg;
      if ((!useTopic && !resource) || (useTopic && !topic) || !payload || !payload.resources) {
        node.error(RED._('aloes.errors.missing-input'));
        return false;
      } else if (useTopic && topic && !isValidTopic(topic)) {
        node.error(RED._('aloes.errors.invalid-topic'));
        return false;
      }
      return true;
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
        if (resource) {
          msg.resource = resource;
        }

        if (!inputsValid(msg)) {
          done();
          return;
        }

        if (useTopic && msg.topic) {
          const parts = msg.topic.split('/');
          if (msg.collection === COLLECTIONS.SENSOR) {
            msg.resource = parts[6];
          }
        }

        let value = msg.payload.resources[resource];
        if (typeof value !== 'boolean') {
          // todo check when boolean might be an object
          if (typeof value === 'object' && value.type && value.data) {
            value = Buffer.from(value.data).toString('utf-8');
          } else if (Buffer.isBuffer(value)) {
            value = value.toString('utf-8');
          } else if (value instanceof Array) {
            value = Buffer.from(value).toString('utf-8');
          }

          if (typeof value === 'string') {
            if (msg.payload === 'true' || msg.payload === '1') {
              msg.payload = true;
            } else if (msg.payload === 'false' || msg.payload === '0') {
              msg.payload = false;
            } else {
              msg.payload = Boolean(value);
            }
          } else if (typeof value === 'number') {
            msg.payload = Boolean(value);
          } else {
            // console.log('to-boolean', { value });
            throw new Error('No value found');
          }
        } else {
          msg.payload = value;
        }

        send(msg);

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
  RED.nodes.registerType('to-boolean', ToBoolean);
};
