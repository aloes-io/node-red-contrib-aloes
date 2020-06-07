module.exports = function (RED) {
  function AloesConfigNode(config) {
    RED.nodes.createNode(this, config);
    this.httpHost = config.httpHost;
    this.httpPort = config.httpPort;
    this.httpApiRoot = config.httpApiRoot;
    this.httpSecure = config.httpSecure;
    this.mqttHost = config.mqttHost;
    this.mqttPort = config.mqttPort;
    this.mqttSecure = config.mqttSecure;
  }
  RED.nodes.registerType('aloes-config', AloesConfigNode, {
    credentials: {
      email: { type: 'text' },
      password: { type: 'password' },
      token: { type: 'text' },
    },
  });
};
