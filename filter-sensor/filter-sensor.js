module.exports = function (RED) {
  // const { getFromFlowContext } = require('../helpers.js');

  function FilterSensor(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    const { nativeNodeId, nativeSensorId, sensorType, sensorResource } = config;

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

        const conditions = {
          nativeNodeId: nativeNodeId || msg.nativeNodeId || null,
          nativeSensorId: nativeSensorId || msg.nativeSensorId || null,
          sensorType: sensorType || msg.sensorType || null,
          sensorResource: sensorResource || msg.sensorResource || null,
        };

        if (!inputsValid(msg)) {
          done();
          return;
        }

        console.log({ conditions: Object.entries(conditions) });

        if (
          Object.entries(conditions).every(([key, value]) =>
            value === null ? true : msg.payload[key] == value,
          )
        ) {
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
  RED.nodes.registerType('filter-sensor', FilterSensor);
};
