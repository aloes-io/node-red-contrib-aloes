const { PATHS, METHODS, COLLECTIONS } = require('../constants');
const {
  getFromGlobalContext,
  setToGlobalContext,
  setHTTPClient,
  login,
  setAloesTopic,
} = require('../helpers');

const saveInstance = {
  device: async (node, deviceName, device) =>
    setToGlobalContext(node, `device-${deviceName}`, device),
  sensor: async (node, sensorName, sensor) =>
    setToGlobalContext(node, `sensor-${sensorName}`, sensor),
};

const sendTo = {
  device: (send, message) => send([message, null]),
  sensor: (send, message) => send([null, message]),
};

const saveAndSendInstance = async (node, send, message) => {
  try {
    node.log(`saveAndSendInstance for ${message.collection} ${message.instanceName}`);

    const type = message.collection.toLowerCase();
    // await saveInstance[type](node, message.instanceName, message.payload);
    return sendTo[type](send, message);
  } catch (error) {
    node.warn(
      `saveAndSendInstance error for ${message.collection} ${message.instanceName} : ${error.message}`,
    );
    return null;
  }
};

const saveAndSendInstances = (node, send, messages) =>
  messages
    .flat()
    .filter((msg) => msg && msg.collection)
    .reduce(async (previousPromise, message) => {
      await previousPromise;
      return saveAndSendInstance(node, send, message);
    }, Promise.resolve());

const parseSensor = async (node, sensor, { userId, includeSensorsResources }) => {
  const sensorName = `${sensor.name}-${sensor.type}-${sensor.nativeNodeId || 0}-${
    sensor.nativeSensorId
  }`;
  node.log(`parseSensors for ${sensorName}`);

  try {
    const method = METHODS.HEAD; // "PUT"

    sensor.method = method;
    if (includeSensorsResources) {
      const resourcesUrl = `${PATHS.SENSOR}/${sensor.id}${PATHS.SENSOR_RESOURCES}`;
      sensor.resources = (await node.http.get(resourcesUrl)) || {};
    }

    // await setToGlobalContext(node, `sensor-${sensorName}`, sensor);
    const topic = setAloesTopic({
      userId,
      collection: COLLECTIONS.SENSOR,
      method,
      instanceId: sensor.id,
    });

    const message = {
      collection: COLLECTIONS.SENSOR,
      instanceName: sensorName,
      payload: sensor,
      topic,
    };

    return message;
  } catch (error) {
    node.warn(`parseSensors error for ${sensorName} : ${error.message}`);
    return null;
  }
};

const parseSensors = async (node, sensors, { userId, includeSensorsResources }) =>
  Promise.all(
    sensors
      .filter((sensor) => sensor && sensor.name)
      .map(async (sensor) => parseSensor(node, sensor, { userId, includeSensorsResources })),
  );

const parseDevice = async (node, device, { userId, includeSensorsResources = false }) => {
  const deviceName = device.name.toLowerCase();
  node.log(`parseDevices for ${deviceName}`);

  try {
    const method = METHODS.HEAD; // "PUT"
    // await setToGlobalContext(node, `device-${deviceName}`, device);

    const topic = setAloesTopic({
      userId,
      collection: COLLECTIONS.DEVICE,
      method,
      instanceId: device.id,
    });

    let sensorMessages = [];
    if (device.sensors && device.sensors.length) {
      sensorMessages = await parseSensors(node, device.sensors, {
        userId,
        includeSensorsResources,
      });
      delete device.sensors;
    }

    const message = {
      collection: COLLECTIONS.DEVICE,
      instanceName: deviceName,
      payload: device,
      topic,
    };
    return [message, ...sensorMessages];
    // node.status({ fill: "blue", shape: "dot", text: "data retrieved" });
  } catch (error) {
    node.warn(`parseDevices error for ${deviceName} : ${error.message}`);
    return [];
  }
};

const parseDevices = async (node, devices, { userId, includeSensorsResources = false }) =>
  Promise.all(
    devices
      .filter((device) => device && device.name)
      .map(async (device) => parseDevice(node, device, { userId, includeSensorsResources })),
  );

const setDeviceQueryUrl = ({ userId, path, includeSensors = false, limit = 50 }) => {
  const include = [];
  if (includeSensors) {
    include.push('sensors');
  }
  const filter = JSON.stringify({
    where: { ownerId: userId },
    include,
    limit,
  });

  return `${path}?filter=${filter}`;
};

module.exports = function (RED) {
  function GetDevicesNode(config) {
    RED.nodes.createNode(this, config);

    const node = this;

    node.aloesConfig = RED.nodes.getNode(config.aloesConfig);
    if (!node.aloesConfig) {
      throw new Error('Missing configuration for get-devices node');
    }

    // console.log('Hello aloes node', { aloesConfig: node.aloesConfig });

    const { credentials } = node.aloesConfig;

    node.http = setHTTPClient(node.aloesConfig);

    node.on('input', async function (msg, send, done) {
      node.log('Starting request');
      try {
        // node.send = send || node.send;
        send =
          send ||
          function () {
            node.send.apply(node, arguments);
          };

        let token = await getFromGlobalContext(node, 'aloesToken');

        if (!token) {
          node.status({ fill: 'grey', shape: 'dot', text: 'Login ...' });
          token = await login(node, credentials);
          node.aloesConfig.token = token;

          await setToGlobalContext(node, 'aloesToken', token);
          node.http.defaults.headers.common.Authorization = token.id;
        }
        node.status({ fill: 'yellow', shape: 'dot', text: 'Get Devices ...' });

        const deviceUrl = setDeviceQueryUrl({
          ...config,
          path: PATHS.DEVICE,
          userId: token.userId,
        });
        const devices = await node.http.get(deviceUrl);
        const messages = await parseDevices(node, devices, { ...token, ...config });

        node.status({ fill: 'blue', shape: 'dot', text: 'Save and send ...' });
        // create option to send the array or a sequence of objects
        // create option to save instances
        await saveAndSendInstances(node, send, messages);

        node.status({ fill: 'green', shape: 'dot', text: 'success' });
        if (done) {
          done();
        }
      } catch (error) {
        if (done) {
          done(error);
        } else {
          node.error(error, msg);
        }

        node.status({ fill: 'red', shape: 'ring', text: error.message || 'error' });
      }
    });

    node.on('close', function (removed, done) {
      if (removed) {
        // node.status({ fill: "yellow", shape: "dot", text: "in progress" });
        // await setToGlobalContext(node, 'aloesToken', undefined);
      } else {
        node.status({ fill: 'grey', shape: 'dot', text: 'starting' });
      }

      // node.debug("Log something more details for debugging the node's behaviour");
      if (done) {
        done();
      }
    });
  }
  RED.nodes.registerType('get-devices', GetDevicesNode);
  // RED.nodes.registerType('get-devices', GetDevicesNode, {
  //   settings: {
  //     getDevicesNode: {
  //       value: 'blue',
  //       exportable: true,
  //     },
  //   },
  // });
};
