module.exports = function (RED) {
  function ExtractSensorResources(config) {
    RED.nodes.createNode(this, config);

    const node = this;

    function inputsValid(msg) {
      if (!msg.payload || !msg.payload.nativeSensorId || !msg.payload.resources) {
        // invalid sensor
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

        if (!inputsValid(msg)) {
          done();
          return;
        }

        // const resourcesKeys = Object.keys(msg.payload.resources);
        Object.entries(msg.payload.resources).map(([resource, value]) => {
          msg.payload.resource = Number(resource);
          msg.payload.value = value;
          msg.method = 'HEAD';
          send(msg);
        });

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
  RED.nodes.registerType('extract-sensor-resources', ExtractSensorResources);
};
