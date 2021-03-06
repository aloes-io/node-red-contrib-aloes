module.exports = function (RED) {
  const { COLLECTIONS, CONNECTION_TYPES, HTTP_APIS, METHODS, PATHS } = require('../constants');
  const { findDevices } = require('../gql-requests');
  const { getDeviceName, getSensorName, getAloesTopic } = require('../helpers');

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

  function GetAloesDevicesNode(config) {
    RED.nodes.createNode(this, config);

    this.connectionType = CONNECTION_TYPES.http;
    this.aloesNetwork = config.aloesNetwork;
    this.aloesConn = RED.nodes.getNode(this.aloesNetwork);
    this.preferredApi = config.preferredApi || HTTP_APIS.graph;

    const node = this;

    if (!node.aloesConn) {
      this.error(RED._('aloes.errors.missing-config'));
    }

    node.aloesConn.on('ready', () => {
      node.userId = node.aloesConn.userId;
      node.aloesConn.register(node);
    });

    const parseSensor = async (sensor, { userId, includeSensorsResources }) => {
      try {
        const instanceName = getSensorName(sensor);
        node.log(`parseSensor ${instanceName}`);

        const method = METHODS.HEAD; // "PUT"
        sensor.method = method;

        if (node.preferredApi === HTTP_APIS.rest && includeSensorsResources) {
          if (includeSensorsResources) {
            const resourcesUrl = `${PATHS.SENSOR}/${sensor.id}${PATHS.SENSOR_RESOURCES}`;
            sensor.resources = (await node.aloesConn.get(node, resourcesUrl)) || {};
          }
        } else if (node.preferredApi === HTTP_APIS.graph && sensor.resources) {
          // const resources = {};
          Object.keys(sensor.resources).forEach((key) => {
            if (key === '__typename') {
              delete sensor.resources[key];
            } else {
              delete Object.assign(sensor.resources, { [key.slice(1)]: sensor.resources[key] })[
                key
              ];
              // resources[key.slice(1)] = sensor.resources[key];
            }
          });
        }

        const topic = getAloesTopic({
          userId,
          collection: COLLECTIONS.SENSOR,
          method,
          instanceId: sensor.id,
        });

        const message = {
          userId,
          collection: COLLECTIONS.SENSOR,
          method,
          instanceName,
          payload: sensor,
          topic,
        };

        return message;
      } catch (error) {
        node.warn(`parseSensor error : ${error.message}`);
        return {};
      }
    };

    const parseSensors = async (sensors, { userId, includeSensorsResources }) =>
      Promise.all(
        sensors.map(async (sensor) => parseSensor(sensor, { userId, includeSensorsResources })),
      );

    const parseDevice = async (device, { userId, includeSensorsResources = false }) => {
      try {
        const instanceName = getDeviceName(device);
        node.log(`parseDevice ${instanceName}`);

        const method = METHODS.HEAD; // "PUT",

        const topic = getAloesTopic({
          userId,
          collection: COLLECTIONS.DEVICE,
          method,
          instanceId: device.id,
        });

        let sensorMessages = [];
        if (device.sensors && device.sensors.length) {
          node.status({ fill: 'blue', shape: 'dot', text: 'Parse Sensors ...' });
          sensorMessages = await parseSensors(device.sensors, {
            userId,
            includeSensorsResources,
          });
          delete device.sensors;
        }

        const message = {
          userId,
          collection: COLLECTIONS.DEVICE,
          method,
          instanceName,
          payload: device,
          topic,
        };
        return [message, ...sensorMessages];
      } catch (error) {
        node.warn(`parseDevice error: ${error.message}`);
        return [];
      }
    };

    const parseDevices = async (devices, { userId, includeSensorsResources = false }) => {
      const result = await Promise.all(
        devices.map(async (device) => parseDevice(device, { userId, includeSensorsResources })),
      );
      return result.flat().filter((msg) => msg && msg.collection);
    };

    node.on('input', async function (msg, send, done) {
      try {
        if (!node.aloesConn || !node.aloesConn.ready) {
          throw new Error(RED._('aloes.errors.not-ready'));
        }
        if (node.aloesConn.ready && !node.aloesConn.users[node.id]) {
          node.aloesConn.register(node);
        }

        send =
          send ||
          function () {
            node.send.apply(node, arguments);
          };

        if (node.preferredApi === HTTP_APIS.rest) {
          const deviceUrl = setDeviceQueryUrl({
            ...config,
            path: PATHS.DEVICE,
            userId: this.userId,
          });

          const devices = await node.aloesConn.get(node, deviceUrl);
          if (devices && devices.length) {
            const messages = await parseDevices(devices, { userId: this.userId, ...config });
            messages.map(send);
            node.status({ fill: 'gree', shape: 'ring', text: 'done' });
          }
        } else if (node.preferredApi === HTTP_APIS.graph) {
          const { data: devicesTree } = await node.aloesConn.getGraph({
            aloesNode: node,
            query: findDevices,
            variables: {
              apiKey: node.aloesConn.tokenId,
              ownerId: node.aloesConn.userId,
              deviceLimit: 50,
            },
          });

          if (devicesTree && devicesTree.auth) {
            let { devices, devicesCount } = devicesTree.auth;
            const messages = await parseDevices(devices, { userId: this.userId, ...config });
            messages.map(send);
            node.status({ fill: 'gree', shape: 'ring', text: 'done' });
          }
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

        node.status({ fill: 'red', shape: 'ring', text: error.message || 'error' });
      }
    });

    node.on('close', function (removed, done) {
      if (node.aloesConn) {
        node.aloesConn.deregister(node, done);
      }
    });
  }
  RED.nodes.registerType('get-aloes-devices', GetAloesDevicesNode);
};
