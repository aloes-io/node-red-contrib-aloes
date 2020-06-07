const axios = require('axios');
const { LOGIN_ROUTE, COLLECTIONS, METHODS } = require('./constants');

const getFromGlobalContext = (node, key) => {
  return new Promise((resolve, reject) => {
    const globalContext = node.context().global;
    globalContext.get(key, (error, res) => {
      if (error) {
        reject(error);
      } else {
        resolve(res);
      }
    });
  });
};

const setToGlobalContext = (node, key, value) => {
  return new Promise((resolve, reject) => {
    const globalContext = node.context().global;
    globalContext.set(key, value, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

const setBaseURL = (aloesConfig) => {
  const { httpPort, httpHost, httpApiRoot, httpSecure } = aloesConfig;
  return `${httpSecure ? 'https' : 'http'}://${httpHost}:${httpPort}${httpApiRoot}`;
};

const setHTTPClient = (aloesConfig) => {
  const baseURL = setBaseURL(aloesConfig);
  const http = axios.create({ baseURL });

  const interceptResErrors = (err) => {
    try {
      // setLoading(false, err.config.uid || err.response.config.uid);
      err = Object.assign(new Error(), err.response.data.error);
    } catch (e) {
      // Will return err if something goes wrong
    }
    return Promise.reject(err);
  };

  const interceptResponse = (res) => {
    // setLoading(false, res.config.uid);
    try {
      return res.data;
    } catch (e) {
      return res;
    }
  };

  http.interceptors.response.use(interceptResponse, interceptResErrors);

  return http;
};

const login = async (node, { email, password }) => {
  try {
    return await node.http.post(LOGIN_ROUTE, {
      email,
      password,
    });
  } catch (error) {
    await setToGlobalContext(node, 'aloesToken', undefined);
    const message = 'Login error';
    node.status({ fill: 'red', shape: 'ring', text: message });
    throw new Error(`${message}: ${error.message}`);
  }
};

// const getRequest = async (node, url) => {
//   try {
//     return await node.http.get(url);
//   } catch (error) {
//     await setToGlobalContext(node, 'aloesToken', undefined);
//     const message = 'Login error';
//     node.status({ fill: 'red', shape: 'ring', text: message });
//     throw new Error(`${message}: ${error.message}`);
//   }
// };

const isValidCollection = (collection) => Object.values(COLLECTIONS).includes(collection);

const isValidMethod = (method) => Object.values(METHODS).includes(method);

const setAloesTopic = ({ userId, method, collection, instanceId = null }) => {
  if (isValidCollection(collection) && isValidMethod(method)) {
    return instanceId
      ? `${userId}/${collection}/${method}/${instanceId}`
      : `${userId}/${collection}/${method}}`;
  }
  return null;
};

module.exports = {
  getFromGlobalContext,
  setToGlobalContext,
  setHTTPClient,
  login,
  setAloesTopic,
  // getRequest,
};
