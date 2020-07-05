module.exports = function (RED) {
  const axios = require('axios');
  const mqtt = require('mqtt');
  const { CONNECTION_TYPES, LOGIN_ROUTE } = require('../constants.js');
  const {
    getBrokerUrl,
    getFromGlobalContext,
    getServerUrl,
    matchTopic,
    setToGlobalContext,
  } = require('../helpers.js');

  const interceptResErrors = (err) => {
    try {
      err = Object.assign(new Error(), err.response.data.error);
    } catch (e) {
      // Will return err if something goes wrong
    }
    return Promise.reject(err);
  };

  const interceptResponse = (res) => {
    try {
      return res.data;
    } catch (e) {
      return res;
    }
  };

  function setProxy() {
    let prox, noprox;
    if (process.env.http_proxy) {
      prox = process.env.http_proxy;
    }
    if (process.env.HTTP_PROXY) {
      prox = process.env.HTTP_PROXY;
    }
    if (process.env.no_proxy) {
      noprox = process.env.no_proxy.split(',');
    }
    if (process.env.NO_PROXY) {
      noprox = process.env.NO_PROXY.split(',');
    }

    return { prox, noprox };
  }

  function getAloesTokenName(node) {
    return `aloesToken-${node.name}`;
  }

  async function login(node, { email, password }) {
    try {
      const token = await node.http.post(`${node.httpApiRoot}${LOGIN_ROUTE}`, {
        email,
        password,
      });
      await setToGlobalContext(node, getAloesTokenName(node), token);
      return token;
    } catch (error) {
      await setToGlobalContext(node, getAloesTokenName(node), undefined);
      const message = 'Login error';
      throw new Error(`${message}: ${error.message}`);
    }
  }

  async function getToken(node, credentials) {
    let token = await getFromGlobalContext(node, getAloesTokenName(node));
    // todo handle case when token is not valid anymore
    if (!token || !token.id) {
      token = await login(node, credentials);
    }
    return token;
  }

  function sendRequestLog(node, id) {
    const text = RED._('aloes.state.send-request', {
      server: node.serverUrl,
    });
    node.log(text);
    node.users[id].status({
      fill: 'yellow',
      shape: 'dot',
      text,
    });
  }

  function successResponseLog(node, id) {
    const text = RED._('aloes.state.response-success', {
      server: node.serverUrl,
    });
    node.log(text);
    node.users[id].status({
      fill: 'green',
      shape: 'dot',
      text,
    });
  }

  function errorResponseLog(node, id) {
    const text = RED._('aloes.state.response-error', {
      server: node.serverUrl,
    });
    node.log(text);
    node.users[id].status({
      fill: 'red',
      shape: 'ring',
      text,
    });
  }

  function AloesNetworkNode(config) {
    RED.nodes.createNode(this, config);

    this.name = config.name;
    this.httpHost = config.httpHost;
    this.httpPort = config.httpPort;
    this.httpApiRoot = config.httpApiRoot;
    this.httpSecure = config.httpSecure;
    this.mqttHost = config.mqttHost;
    this.mqttPort = config.mqttPort;
    this.mqttSecure = config.mqttSecure;

    // this.usews = config.usews;
    // this.verifyservercert = config.verifyservercert;
    // this.compatmode = config.compatmode;
    this.keepalive = config.keepalive;
    this.cleansession = config.cleansession;

    // Config node state
    this.serverUrl = '';
    this.httpOptions = {};
    this.brokerUrl = '';
    this.connected = false;
    this.connecting = false;
    this.closing = false;
    this.mqttOptions = {};
    this.queue = [];
    this.subscriptions = {};
    this.ready = false;
    this.errored = false;

    this.userId = '';
    this.tokenId = '';

    if (this.credentials) {
      this.email = this.credentials.email;
      this.password = this.credentials.password;
    }

    if (typeof this.httpSecure === 'undefined') {
      this.httpSecure = false;
    }
    if (typeof this.mqttSecure === 'undefined') {
      this.mqttSecure = false;
    }
    // if (typeof this.usews === 'undefined') {
    //   this.usews = false;
    // }
    if (typeof this.compatmode === 'undefined') {
      this.compatmode = false;
    }
    if (typeof this.verifyservercert === 'undefined') {
      this.verifyservercert = false;
    }
    if (typeof this.keepalive === 'undefined') {
      this.keepalive = 60;
    } else if (typeof this.keepalive === 'string') {
      this.keepalive = Number(this.keepalive);
    }
    if (typeof this.cleansession === 'undefined') {
      this.cleansession = true;
    }

    const { prox, noprox } = setProxy();

    // Create the URL to pass in to the Axios library
    if (this.serverUrl === '') {
      const { serverUrl } = getServerUrl(
        {
          host: this.httpHost,
          port: this.httpPort,
          apiRoot: this.httpApiRoot,
          secure: this.httpSecure,
        },
        prox,
        noprox,
      );
      this.serverUrl = serverUrl;
      // if (httpOptions) {
      //   this.httpOptions.httpOptions = httpOptions;
      // }
    }

    // Create the URL to pass in to the MQTT.js library
    if (this.brokerUrl === '') {
      const { brokerUrl, wsOptions } = getBrokerUrl(
        {
          host: this.mqttHost,
          port: this.mqttPort,
          secure: this.mqttSecure,
        },
        prox,
        noprox,
      );

      this.brokerUrl = brokerUrl;
      if (wsOptions) {
        this.mqttOptions.wsOptions = wsOptions;
      }
    }

    this.http = axios.create({ baseURL: this.serverUrl });
    this.http.interceptors.response.use(interceptResponse, interceptResErrors);

    getToken(this, this.credentials)
      .then((token) => {
        this.userId = token.userId;
        this.tokenId = token.id;

        this.http.defaults.headers.common.Authorization = this.tokenId;

        if (this.httpSecure && config.httpTls) {
          const tlsNode = RED.nodes.getNode(config.httpTls);
          if (tlsNode) {
            tlsNode.addTLSOptions(this.httpOptions);
          }
        }

        this.mqttOptions.clientId = `${this.userId}-${(1 + Math.random() * 4294967295).toString(
          16,
        )}`;
        this.mqttOptions.username = this.userId;
        this.mqttOptions.password = this.tokenId;
        this.mqttOptions.keepalive = this.keepalive;
        this.mqttOptions.clean = this.cleansession;
        this.mqttOptions.reconnectPeriod = RED.settings.mqttReconnectTime || 5000;

        if (this.compatmode == 'true' || this.compatmode === true) {
          this.mqttOptions.protocolId = 'MQIsdp';
          this.mqttOptions.protocolVersion = 3;
        }

        if (this.mqttSecure && config.mqttTls) {
          const tlsNode = RED.nodes.getNode(config.mqttTls);
          if (tlsNode) {
            tlsNode.addTLSOptions(this.mqttOptions);
          }
        }

        if (typeof this.mqttOptions.rejectUnauthorized === 'undefined') {
          this.mqttOptions.rejectUnauthorized =
            this.verifyservercert == 'true' || this.verifyservercert === true;
        }
        this.ready = true;
        this.emit('ready');
        node.log(
          RED._('aloes.state.login-success', {
            server: node.serverUrl,
          }),
        );
      })
      .catch((error) => {
        this.errored = true;
        this.emit('error', error);
        node.error(
          RED._('aloes.state.login-error', {
            server: node.serverUrl,
          }),
        );
      });

    const node = this;
    this.users = {};

    this.register = function (aloesNode) {
      node.users[aloesNode.id] = aloesNode;
      const { connectionType } = aloesNode;
      if (connectionType === CONNECTION_TYPES.mqtt) {
        if (Object.keys(node.users).length === 1) {
          node.connect();
        }
      }
    };

    this.deregister = function (aloesNode, done) {
      delete node.users[aloesNode.id];
      const { connectionType } = aloesNode;
      if (connectionType === CONNECTION_TYPES.http) {
        return done();
      }
      if (node.closing) {
        return done();
      }
      if (Object.keys(node.users).length === 0) {
        if (node.client && node.client.connected) {
          return node.client.end(done);
        } else {
          node.client.end();
          return done();
        }
      }
      done();
    };

    this.getGraph = async function ({ aloesNode, query, variables }) {
      const { id } = aloesNode;
      let result = {};
      sendRequestLog(node, id);
      try {
        result = await node.http.post(`/graphql`, {
          query,
          variables,
        });

        if (result.errors && result.errors.length) {
          throw new Error(result.errors[0].message);
        }
        successResponseLog(node, id);
      } catch (e) {
        errorResponseLog(node, id);
      } finally {
        return result;
      }
    };

    this.get = async function (aloesNode, url) {
      const { id } = aloesNode;
      let result;
      sendRequestLog(node, id);
      try {
        // result = await node.http.get(url);
        result = await node.http.get(`${node.httpApiRoot}${url}`);
        successResponseLog(node, id);
      } catch (e) {
        errorResponseLog(node, id);
      } finally {
        return result;
      }
    };

    this.post = async function (aloesNode, url, body) {
      const { id } = aloesNode;
      let result;
      sendRequestLog(node, id);
      try {
        // result = await node.http.post(url, body);
        result = await node.http.post(`${node.httpApiRoot}${url}`, body);
        successResponseLog(node, id);
      } catch (e) {
        errorResponseLog(node, id);
      } finally {
        return result;
      }
    };

    this.connect = function () {
      if (node.ready && !node.connected && !node.connecting) {
        node.connecting = true;
        try {
          node.client = mqtt.connect(node.brokerUrl, node.mqttOptions);
          node.client.setMaxListeners(0);
          // Register successful connect or reconnect handler
          node.client.on('connect', function () {
            node.connecting = false;
            node.connected = true;
            node.emit('connected');

            node.log(
              RED._('aloes.state.connected', {
                broker: (node.clientid ? node.clientid + '@' : '') + node.brokerUrl,
              }),
            );
            for (let id in node.users) {
              if (
                node.users.hasOwnProperty(id) &&
                node.users[id].connectionType === CONNECTION_TYPES.mqtt
              ) {
                node.users[id].status({
                  fill: 'green',
                  shape: 'dot',
                  text: 'node-red:common.status.connected',
                });
              }
            }
            // Remove any existing listeners before resubscribing to avoid duplicates in the event of a re-connection
            node.client.removeAllListeners('message');

            // Re-subscribe to stored topics
            for (let s in node.subscriptions) {
              if (node.subscriptions.hasOwnProperty(s)) {
                let topic = s;
                let qos = 0;
                for (let r in node.subscriptions[s]) {
                  if (node.subscriptions[s].hasOwnProperty(r)) {
                    qos = Math.max(qos, node.subscriptions[s][r].qos);
                    node.client.on('message', node.subscriptions[s][r].handler);
                  }
                }
                const options = { qos };
                node.client.subscribe(topic, options);
              }
            }

            // Send any birth message
            if (node.birthMessage) {
              node.publish(node.birthMessage);
            }
          });

          node.client.on('reconnect', function () {
            for (let id in node.users) {
              if (
                node.users.hasOwnProperty(id) &&
                node.users[id].connectionType === CONNECTION_TYPES.mqtt
              ) {
                node.users[id].status({
                  fill: 'yellow',
                  shape: 'ring',
                  text: 'node-red:common.status.connecting',
                });
              }
            }
          });

          // Register disconnect handlers
          node.client.on('close', function () {
            node.emit('close');

            if (node.connected) {
              node.connected = false;
              node.log(
                RED._('aloes.state.disconnected', {
                  broker: (node.clientid ? node.clientid + '@' : '') + node.brokerUrl,
                }),
              );
              for (let id in node.users) {
                if (
                  node.users.hasOwnProperty(id) &&
                  node.users[id].connectionType === CONNECTION_TYPES.mqtt
                ) {
                  node.users[id].status({
                    fill: 'red',
                    shape: 'ring',
                    text: 'node-red:common.status.disconnected',
                  });
                }
              }
            } else if (node.connecting) {
              node.log(
                RED._('aloes.state.connect-failed', {
                  broker: (node.clientid ? node.clientid + '@' : '') + node.brokerUrl,
                }),
              );
            }
          });

          // Register connect error handler
          // The client's own reconnect logic will take care of errors
          node.client.on('error', function (error) {
            node.emit('error', error);
          });
        } catch (err) {
          console.log(err);
        }
      }
    };

    this.subscribe = function (topic, qos, callback, ref = 0) {
      node.subscriptions[topic] = node.subscriptions[topic] || {};
      const sub = {
        topic: topic,
        qos: qos,
        handler: function (mtopic, mpayload, mpacket) {
          if (matchTopic(topic, mtopic)) {
            callback(mtopic, mpayload, mpacket);
          }
        },
        ref,
      };
      node.subscriptions[topic][ref] = sub;
      if (node.connected) {
        node.client.on('message', sub.handler);
        const options = { qos };
        node.client.subscribe(topic, options);
      }
    };

    this.unsubscribe = function (topic, ref = 0, removed = false) {
      const sub = node.subscriptions[topic];
      if (sub) {
        if (sub[ref]) {
          node.client.removeListener('message', sub[ref].handler);
          delete sub[ref];
        }
        if (removed) {
          if (Object.keys(sub).length === 0) {
            delete node.subscriptions[topic];
            if (node.connected) {
              node.client.unsubscribe(topic);
            }
          }
        }
      }
    };

    this.publish = function (msg, done) {
      if (node.connected) {
        if (msg.payload === null || msg.payload === undefined) {
          msg.payload = '';
        } else if (!Buffer.isBuffer(msg.payload)) {
          if (typeof msg.payload === 'object') {
            msg.payload = JSON.stringify(msg.payload);
          } else if (typeof msg.payload !== 'string') {
            msg.payload = '' + msg.payload;
          }
        }

        const options = {
          qos: msg.qos || 0,
          retain: msg.retain || false,
        };
        node.client.publish(msg.topic, msg.payload, options, function (err) {
          done && done();
          return;
        });
      }
    };

    this.on('close', async function (done) {
      this.closing = true;
      this.ready = false;
      this.errored = false;
      delete node.http.defaults.headers.common.Authorization;
      delete node.http;

      node.log(
        RED._('aloes.state.stop-http', {
          server: node.serverUrl,
        }),
      );
      node.log(
        RED._('aloes.state.stop-mqtt', {
          broker: (node.clientid ? node.clientid + '@' : '') + node.brokerUrl,
        }),
      );

      await setToGlobalContext(node, getAloesTokenName(node), undefined);

      if (this.connected) {
        // Send close message
        if (node.closeMessage) {
          node.publish(node.closeMessage);
        }
        this.client.once('close', function () {
          done();
        });
        this.client.end();
      } else if (this.connecting || node.client.reconnecting) {
        node.client.end();
        done();
      } else {
        done();
      }
    });
  }
  RED.nodes.registerType('aloes-network', AloesNetworkNode, {
    credentials: {
      email: { type: 'text' },
      password: { type: 'password' },
      token: { type: 'text' },
    },
  });
};
