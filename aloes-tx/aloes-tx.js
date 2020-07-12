module.exports = function (RED) {
  const { CONNECTION_TYPES } = require('../constants');
  const { isValidCollection, isValidMethod } = require('../validators');

  function AloesTxNode(config) {
    RED.nodes.createNode(this, config);

    this.topic = config.topic;
    this.qos = config.qos || null;
    this.retain = config.retain;
    this.connectionType = CONNECTION_TYPES.mqtt;
    this.aloesNetwork = config.aloesNetwork;
    this.aloesConn = RED.nodes.getNode(this.aloesNetwork);

    const node = this;
    const chk = /[\+#]/;

    if (!node.aloesConn) {
      this.error(RED._('aloes.errors.missing-config'));
    }

    this.status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected' });

    function inputsValid(topic) {
      const [userId, collection, method] = topic.split('/');
      if (!node.aloesConn.userId || !userId || node.aloesConn.userId !== userId) {
        node.warn(RED._('aloes.errors.invalid-user-id'));
        return false;
      } else if (!isValidCollection(collection)) {
        node.warn(RED._('aloes.errors.invalid-collection'));
        return false;
      } else if (!isValidMethod(method)) {
        node.warn(RED._('aloes.errors.invalid-method'));
        return false;
      }
      return true;
    }

    node.aloesConn.on('ready', () => {
      node.aloesConn.register(node);
    });

    // node.aloesConn.on('connected', () => {
    //   node.status({ fill: 'green', shape: 'dot', text: 'node-red:common.status.connected' });
    // });

    // node.aloesConn.on('disconnected', () => {
    //   node.status({ fill: 'green', shape: 'dot', text: 'node-red:common.status.connected' });
    // });

    // node.aloesConn.on('error', (e) => {
    //   node.error(e);
    // });

    this.on('input', function (msg, send, done) {
      if (msg.qos) {
        msg.qos = parseInt(msg.qos);
        if (msg.qos !== 0 && msg.qos !== 1 && msg.qos !== 2) {
          msg.qos = null;
        }
      }
      msg.qos = Number(node.qos || msg.qos || 0);
      msg.retain = node.retain || msg.retain || false;
      msg.retain = msg.retain === true || msg.retain === 'true' || false;
      if (node.topic) {
        msg.topic = node.topic;
      }
      if (msg.hasOwnProperty('payload')) {
        if (msg.hasOwnProperty('topic') && typeof msg.topic === 'string' && msg.topic !== '') {
          if (chk.test(msg.topic)) {
            node.warn(RED._('aloes.errors.invalid-topic'));
          }

          if (inputsValid(msg.topic)) {
            this.log(`publish to ${msg.topic}`);
            this.aloesConn.publish(msg, done);
          }
          done();
        } else {
          node.warn(RED._('aloes.errors.invalid-topic'));
          done();
        }
      } else {
        done();
      }
    });

    this.on('close', function (done) {
      node.aloesConn.deregister(node, done);
    });
  }
  RED.nodes.registerType('aloes-tx', AloesTxNode);
};
