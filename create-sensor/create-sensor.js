module.exports = function (RED) {
  function CreateSensor(config) {
    const { aloesClientEncoder } = require('aloes-handlers');
    const { aloesLightPatternDetector, aloesLightDecoder } = require('aloes-light-handlers');
    const { COLLECTIONS } = require('../constants');
    const { getFromGlobalContext, getGlobalStorageType, setStorageKey } = require('../storage');

    const { settings } = RED;

    RED.nodes.createNode(this, config);

    const node = this;
    const { deviceName, protocol, topic } = config;
    const storageType = getGlobalStorageType(settings);

    async function getDevice(msg) {
      msg.collection = COLLECTIONS.DEVICE;
      const storageKey = setStorageKey(msg);
      const device = await getFromGlobalContext(node, storageKey, storageType);
      return device || null;
    }

    function buildSensor(device, attributes) {
      return {
        name: attributes.name || null,
        type: attributes.type,
        method: attributes.method,
        createdAt: Date.now(),
        lastSignal: attributes.lastSignal || Date.now(),
        resources: attributes.resources,
        resource: Number(attributes.resource),
        value: attributes.value,
        icons: attributes.icons,
        colors: attributes.colors,
        nativeType: attributes.nativeType,
        nativeResource: attributes.nativeResource,
        nativeSensorId: attributes.nativeSensorId,
        nativeNodeId: attributes.nativeNodeId || null,
        frameCounter: attributes.frameCounter || 0,
        inPrefix: attributes.inPrefix || null,
        outPrefix: attributes.outPrefix || null,
        // inputPath: attributes.inputPath || null,
        // outputPath: attributes.outputPath || null,
        transportProtocol: device.transportProtocol,
        transportProtocolVersion: device.transportProtocolVersion,
        messageProtocol: device.messageProtocol,
        messageProtocolVersion: device.messageProtocolVersion,
        devEui: device.devEui,
        devAddr: device.devAddr,
        ownerId: device.ownerId,
      };
    }

    // TODO: handle several encoding types
    function encode(packet) {
      const protocol = aloesLightPatternDetector(packet);
      return aloesLightDecoder(packet, protocol.params);
    }

    function setTopic(ownerId, data) {
      const { topic } = aloesClientEncoder({
        pattern: 'aloesclient',
        collection: COLLECTIONS.SENSOR,
        method: 'HEAD',
        userId: ownerId,
        data
      });
      return topic;
    }

    function inputsValid(msg) {
      if (!msg.deviceName || !msg.payload || !msg.topic || !msg.protocol) {
        return false;
      }
      return true;
    }

    node.on('input', async function (msg, send, done) {
      try {
        send =
          send ||
          function () {
            node.send.apply(node, arguments);
          };

        if (deviceName) {
          msg.deviceName = deviceName;
        }
        if (protocol) {
          msg.protocol = protocol;
        }
        if (topic) {
          msg.topic = topic;
        }

        if (!inputsValid(msg)) {
          const text = RED._('aloes.errors.missing-input');
          throw new Error(text);
        }

        const device = await getDevice(msg);
        if (!device) {
          const text = RED._('aloes.errors.device-not-found');
          throw new Error(text);
        }

        const attributes = encode(msg);
        const sensor = buildSensor(device, attributes);
        if (!sensor) {
          const text = RED._('aloes.errors.sensor-not-created');
          throw new Error(text);
        }
        msg.collection = COLLECTIONS.SENSOR;
        msg.topic = setTopic(device.ownerId, msg.payload);
        msg.payload = sensor;
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

  RED.nodes.registerType('create-sensor', CreateSensor);
};
