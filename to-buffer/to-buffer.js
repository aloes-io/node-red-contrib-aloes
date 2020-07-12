module.exports = function (RED) {
  const isUtf8 = require('is-utf8');
  const { isValidTopic } = require('../validators');

  function ToBuffer(config) {
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
        if (!Buffer.isBuffer(value)) {
          if (typeof value === 'string') {
            if (isUtf8(value)) {
              value = value.toString();
              try {
                // value = JSON.parse(value);
                msg.payload = JSON.parse(value).data;
                // msg.payload = Buffer.from(JSON.parse(value).data, 'utf-8')
              } catch (e) {
                msg.payload = null;
              }
            } else {
              msg.payload = Buffer.from(value, 'utf-8').toJSON().data;
            }
          } else if (typeof value === 'object' && value.type && value.data) {
            msg.payload = Buffer.from(value.data);
          } else if (value instanceof Array) {
            msg.payload = Buffer.from(value);
          } else {
            msg.payload = Buffer.from(value);
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
  RED.nodes.registerType('to-buffer', ToBuffer);
};
