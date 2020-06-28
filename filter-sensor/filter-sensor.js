module.exports = function (RED) {
  function FilterSensor(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    const { nativeNodeId, nativeSensorId, sensorType, sensorResource } = config;

    function inputsValid(msg) {
      if (
        !msg.payload ||
        msg.payload.type === undefined ||
        !msg.payload.nativeSensorId ||
        !msg.payload.nativeNodeId ||
        msg.payload.resource === undefined
      ) {
        // invalid sensor
        return false;
      }
      return true;
    }

    function conditionsPassed(msg) {
      const conditions = {
        nativeNodeId: nativeNodeId || msg.nativeNodeId || null,
        nativeSensorId: nativeSensorId || msg.nativeSensorId || null,
        type: sensorType || msg.sensorType || null,
        resource: sensorResource || msg.sensorResource || null,
      };

      // console.log({ conditions: Object.entries(conditions) });
      return Object.entries(conditions).every(([key, value]) => {
        if (value === null) return true;
        if (value instanceof Array) {
          return value.some((val) => msg.payload[key] == val);
        }
        if (value.startsWith('[') && value.endsWith(']')) {
          return JSON.parse(value).some((val) => msg.payload[key] == val);
        }
        return msg.payload[key] == value;
      });
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

        const sensorIsValid = conditionsPassed(msg);

        if (sensorIsValid) {
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
