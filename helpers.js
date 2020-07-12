const HttpsProxyAgent = require('https-proxy-agent');
const url = require('url');
const { COLLECTIONS } = require('./constants');
const { isValidCollection, isValidMethod } = require('./validators');

function getServerUrl(
  { host = 'localhost', port = null, apiRoot = '/api', secure = false },
  prox,
  noprox,
) {
  let serverUrl;
  let httpOptions;
  // if the broker may be ws:// or wss:// or even tcp://
  if (host.indexOf('://') > -1) {
    serverUrl = host;
    if (serverUrl.indexOf('https://') > -1 || serverUrl.indexOf('http://') > -1) {
      // check if proxy is set in env
      let noproxy;
      if (noprox) {
        for (let i = 0; i < noprox.length; i += 1) {
          if (serverUrl.indexOf(noprox[i].trim()) !== -1) {
            noproxy = true;
          }
        }
      }
      if (prox && !noproxy) {
        const parsedUrl = url.parse(serverUrl);
        const proxyOpts = url.parse(prox);
        proxyOpts.secureEndpoint = parsedUrl.protocol ? parsedUrl.protocol === 'https:' : true;
        const agent = new HttpsProxyAgent(proxyOpts);
        httpOptions = {
          agent,
        };
      }
    }
  } else {
    if (secure) {
      serverUrl = 'https://';
    } else {
      serverUrl = 'http://';
    }
    if (host !== '') {
      //Check for an IPv6 address
      if (
        /(?:^|(?<=\s))(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))(?=\s|$)/.test(
          host,
        )
      ) {
        serverUrl = serverUrl + '[' + host + ']:';
      } else {
        serverUrl = serverUrl + host + ':';
      }
      // port now defaults to 8000 if unset.
      if (!port) {
        serverUrl = serverUrl + '8000';
      } else {
        serverUrl = serverUrl + port;
      }
    } else {
      serverUrl = serverUrl + 'localhost:8000';
    }
  }
  // serverUrl += apiRoot;
  return { serverUrl, httpOptions };
}

function getBrokerUrl({ host = 'localhost', port = null, secure = false }, prox, noprox) {
  let brokerUrl;
  let wsOptions;
  // if the broker may be ws:// or wss:// or even tcp://
  if (host.indexOf('://') > -1) {
    brokerUrl = host;
    // Only for ws or wss, check if proxy env var for additional configuration
    if (brokerUrl.indexOf('wss://') > -1 || brokerUrl.indexOf('ws://') > -1) {
      // check if proxy is set in env
      let noproxy;
      if (noprox) {
        for (let i = 0; i < noprox.length; i += 1) {
          if (brokerUrl.indexOf(noprox[i].trim()) !== -1) {
            noproxy = true;
          }
        }
      }
      if (prox && !noproxy) {
        const parsedUrl = url.parse(brokerUrl);
        const proxyOpts = url.parse(prox);
        // true for wss
        proxyOpts.secureEndpoint = parsedUrl.protocol ? parsedUrl.protocol === 'wss:' : true;
        // Set Agent for wsOption in MQTT
        const agent = new HttpsProxyAgent(proxyOpts);
        wsOptions = {
          agent,
        };
      }
    }
  } else {
    // construct the std mqtt:// url
    if (secure) {
      brokerUrl = 'mqtts://';
    } else {
      brokerUrl = 'mqtt://';
    }
    if (host !== '') {
      //Check for an IPv6 address
      if (
        /(?:^|(?<=\s))(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))(?=\s|$)/.test(
          host,
        )
      ) {
        brokerUrl = brokerUrl + '[' + host + ']:';
      } else {
        brokerUrl = brokerUrl + host + ':';
      }
      // port now defaults to 1883 if unset.
      if (!port) {
        brokerUrl = brokerUrl + '1883';
      } else {
        brokerUrl = brokerUrl + port;
      }
    } else {
      brokerUrl = brokerUrl + 'localhost:1883';
    }
  }
  return { brokerUrl, wsOptions };
}

const getAloesTopic = ({ userId, method, collection, instanceId = null }) => {
  if (isValidCollection(collection) && isValidMethod(method)) {
    return instanceId
      ? `${userId}/${collection}/${method}/${instanceId}`
      : `${userId}/${collection}/${method}}`;
  }
  return null;
};

const getDeviceName = (device) => device.name.replace(' ', '-').toLowerCase();

const getSensorName = (sensor) =>
  `${sensor.type}-${sensor.nativeNodeId || 0}-${sensor.nativeSensorId}`;

const getMeasurementName = (measurement) =>
  `${measurement.type}-${measurement.sensorNodeId || 0}-${measurement.nativeSensorId}`;

const getInstanceName = {
  [COLLECTIONS.DEVICE.toLowerCase()]: (payload) => getDeviceName(payload),
  [COLLECTIONS.SENSOR.toLowerCase()]: (payload) => getSensorName(payload),
  [COLLECTIONS.MEASUREMENT.toLowerCase()]: (payload) => getMeasurementName(payload),
};

const sendTo = {
  [COLLECTIONS.DEVICE.toLowerCase()]: (send, message) => send([message, null, null]),
  [COLLECTIONS.SENSOR.toLowerCase()]: (send, message) => send([null, message, null]),
  [COLLECTIONS.MEASUREMENT.toLowerCase()]: (send, message) => send([null, null, message]),
};

module.exports = {
  getAloesTopic,
  getBrokerUrl,
  getDeviceName,
  getSensorName,
  getServerUrl,
  getInstanceName,
  sendTo,
};
