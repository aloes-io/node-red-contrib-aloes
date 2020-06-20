module.exports = function (RED) {
  const isUtf8 = require('is-utf8');
  const { CONNECTION_TYPES } = require('../constants.js');
  const { getInstanceName, isValidCollection, isValidMethod } = require('../helpers');

  function AloesRxNode(config) {
    RED.nodes.createNode(this, config);

    this.collection = config.collection;
    this.topic = config.topic;
    this.qos = parseInt(config.qos);
    this.connectionType = CONNECTION_TYPES.mqtt;

    if (isNaN(this.qos) || this.qos < 0 || this.qos > 2) {
      this.qos = 0;
    }

    this.datatype = config.datatype || 'utf8';
    this.aloesNetwork = config.aloesNetwork;
    this.aloesConn = RED.nodes.getNode(this.aloesNetwork);

    if (!this.aloesConn) {
      this.error(RED._('aloes.errors.missing-config'));
    }

    this.status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected' });

    const node = this;

    function inputsValid(parts) {
      const [, collection, method] = parts;
      if (!collection) {
        node.error(RED._('aloes.errors.missing-collection'));
        return false;
      } else if (!isValidCollection(collection)) {
        node.error(RED._('aloes.errors.invalid-collection'));
        return false;
      } else if (!isValidMethod(method)) {
        node.error(RED._('aloes.errors.invalid-method'));
        return false;
      }
      return true;
    }

    function parsePayload(packet) {
      let { topic, payload, qos, retain } = packet;
      if (node.datatype === 'buffer') {
        // payload = payload;
        try {
          payload = JSON.parse(payload.toString());
        } catch (e) {
          node.error(RED._('aloes.errors.invalid-json-parse'), {
            payload,
            topic,
            qos,
            retain,
          });
          return null;
        }
      } else if (node.datatype === 'base64') {
        payload = payload.toString('base64');
      } else if (node.datatype === 'utf8') {
        payload = payload.toString('utf8');
      } else if (node.datatype === 'json') {
        if (isUtf8(payload)) {
          payload = payload.toString();
          try {
            payload = JSON.parse(payload);
          } catch (e) {
            node.error(RED._('aloes.errors.invalid-json-parse'), {
              payload,
              topic,
              qos,
              retain,
            });
            return null;
          }
        } else {
          node.error(RED._('aloes.errors.invalid-json-string'), {
            payload,
            topic,
            qos,
            retain,
          });
          return null;
        }
      } else {
        if (isUtf8(payload)) {
          payload = payload.toString();
        }
      }
      return payload;
    }

    function messageCallback(topic, payload, packet) {
      const parts = topic.split('/');
      if (!inputsValid(parts)) {
        return;
      }

      payload = parsePayload({ ...packet, topic, payload });
      if (!payload) {
        return;
      }
      const [userId, collection, method] = parts;
      const type = collection.toLowerCase();
      const instanceName = getInstanceName[type](payload);

      const msg = {
        userId,
        collection,
        method,
        instanceName,
        ...packet,
        topic,
        payload,
      };

      node.send(msg);
    }

    // node.aloesConn.on('error', () => {
    //   node.error('node.aloesConn.error');
    // });

    node.aloesConn.on('ready', () => {
      const userId = this.aloesConn.userId;
      this.topic = this.collection ? `${userId}/${this.collection}/#` : `${userId}/#`;

      if (!/^(#$|(\+|[^+#]*)(\/(\+|[^+#]*))*(\/(\+|#|[^+#]*))?$)/.test(this.topic)) {
        return this.warn(RED._('aloes.errors.invalid-topic'));
      }

      if (this.topic) {
        node.aloesConn.register(this);
        this.aloesConn.subscribe(this.topic, this.qos, messageCallback, this.id);

        if (this.aloesConn.connected) {
          node.status({ fill: 'green', shape: 'dot', text: 'node-red:common.status.connected' });
        }
      } else {
        this.error(RED._('aloes.errors.not-defined'));
      }
    });

    this.on('close', function (removed, done) {
      if (node.aloesConn) {
        node.aloesConn.unsubscribe(node.topic, node.id, removed);
        node.aloesConn.deregister(node, done);
      }
    });
  }
  RED.nodes.registerType('aloes-rx', AloesRxNode);
};
