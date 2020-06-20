module.exports = function (RED) {
  const { CONNECTION_TYPES } = require('../constants.js');
  const { isValidCollection } = require('../helpers.js');

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

    // node.aloesConn.on('error', (e) => {
    //   console.log()
    // });

    node.aloesConn.on('ready', () => {
      if (this.aloesConn.connected) {
        node.status({ fill: 'green', shape: 'dot', text: 'node-red:common.status.connected' });
      }
      node.aloesConn.register(node);
    });

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
          // topic must exist
          if (chk.test(msg.topic)) {
            node.warn(RED._('aloes.errors.invalid-topic'));
          }
          const [userId, collection] = msg.topic.split('/');

          if (!this.aloesConn.userId || !userId || this.aloesConn.userId !== userId) {
            node.warn(RED._('aloes.errors.invalid-user-id'));
            done();
          } else if (!isValidCollection(collection)) {
            node.warn(RED._('aloes.errors.invalid-collection'));
            done();
          } else {
            this.aloesConn.publish(msg, done);
          }
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
