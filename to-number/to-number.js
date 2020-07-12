module.exports = function (RED) {
  const { isValidTopic } = require('../validators');

  function ToNumber(config) {
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
        if (typeof value !== 'number') {
          // todo check when number might be an object
          if (typeof value === 'object' && value.type && value.data) {
            value = Buffer.from(value).toString('utf-8');
          } else if (Buffer.isBuffer(value)) {
            value = value.toString('utf-8');
          } else if (value instanceof Array) {
            value = Buffer.from(value).toString('utf-8');
          }

          if (typeof value === 'string') {
            if (value === 'true') {
              msg.payload = 1;
            } else if (value === 'false') {
              msg.payload = 0;
            } else {
              msg.payload = Number(value);
            }
          } else if (typeof value === 'boolean') {
            if (value === true) {
              msg.payload = 1;
            } else {
              msg.payload = 0;
            }
          } else {
            throw new Error('No value found');
          }
        } else {
          msg.payload = value;
        }

        // const unit = env.get('unit');
        // if (unit && unit !== null) {
        //   msg.unit = unit;
        // }
        // if (msg.payload.resources['5701']) {
        //   msg.payload = Number(msg.payload.toPrecision(precision));
        // }

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
  RED.nodes.registerType('to-number', ToNumber);
};
