module.exports = function (RED) {
  const axios = require('axios');
  const mqtt = require('mqtt');
  // const util = require('util');
  const HttpsProxyAgent = require('https-proxy-agent');
  const url = require('url');
  const { CONNECTION_TYPES, LOGIN_ROUTE } = require('../constants.js');
  const { getFromGlobalContext, setToGlobalContext } = require('../helpers.js');

  function matchTopic(ts, t) {
    if (ts === '#') {
      return true;
    } else if (ts.startsWith('$share')) {
      /* The following allows shared subscriptions (as in MQTT v5)
       http://docs.oasis-open.org/mqtt/mqtt/v5.0/cs02/mqtt-v5.0-cs02.html#_Toc514345522
       4.8.2 describes shares like:
       $share/{ShareName}/{filter}
       $share is a literal string that marks the Topic Filter as being a Shared Subscription Topic Filter.
       {ShareName} is a character string that does not include "/", "+" or "#"
       {filter} The remainder of the string has the same syntax and semantics as a Topic Filter in a non-shared subscription. Refer to section 4.7.
    */
      ts = ts.replace(/^\$share\/[^#+/]+\/(.*)/g, '$1');
    }
    const re = new RegExp(
      '^' +
        ts
          .replace(/([\[\]\?\(\)\\\\$\^\*\.|])/g, '\\$1')
          .replace(/\+/g, '[^/]+')
          .replace(/\/#$/, '(/.*)?') +
        '$',
    );
    return re.test(t);
  }

  function getServerUrl(
    httpHost = 'localhost',
    httpPort = null,
    httpApiRoot = '/api',
    prox,
    noprox,
    httpSecure = false,
  ) {
    let serverUrl;
    let httpOptions;
    // if the broker may be ws:// or wss:// or even tcp://
    if (httpHost.indexOf('://') > -1) {
      serverUrl = httpHost;
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
      if (httpSecure) {
        serverUrl = 'https://';
      } else {
        serverUrl = 'http://';
      }
      if (httpHost !== '') {
        //Check for an IPv6 address
        if (
          /(?:^|(?<=\s))(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))(?=\s|$)/.test(
            httpHost,
          )
        ) {
          serverUrl = serverUrl + '[' + httpHost + ']:';
        } else {
          serverUrl = serverUrl + httpHost + ':';
        }
        // port now defaults to 8000 if unset.
        if (!httpPort) {
          serverUrl = serverUrl + '8000';
        } else {
          serverUrl = serverUrl + httpPort;
        }
      } else {
        serverUrl = serverUrl + 'localhost:8000';
      }
    }
    serverUrl += httpApiRoot;
    return { serverUrl, httpOptions };
  }

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

  function getBrokerUrl(mqttHost = 'localhost', mqttPort = null, prox, noprox, mqttSecure = false) {
    let brokerUrl;
    let wsOptions;
    // if the broker may be ws:// or wss:// or even tcp://
    if (mqttHost.indexOf('://') > -1) {
      brokerUrl = mqttHost;
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
      if (mqttSecure) {
        brokerUrl = 'mqtts://';
      } else {
        brokerUrl = 'mqtt://';
      }
      if (mqttHost !== '') {
        //Check for an IPv6 address
        if (
          /(?:^|(?<=\s))(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))(?=\s|$)/.test(
            mqttHost,
          )
        ) {
          brokerUrl = brokerUrl + '[' + mqttHost + ']:';
        } else {
          brokerUrl = brokerUrl + mqttHost + ':';
        }
        // port now defaults to 1883 if unset.
        if (!mqttPort) {
          brokerUrl = brokerUrl + '1883';
        } else {
          brokerUrl = brokerUrl + mqttPort;
        }
      } else {
        brokerUrl = brokerUrl + 'localhost:1883';
      }
    }
    return { brokerUrl, wsOptions };
  }

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

  async function login(node, { email, password }) {
    try {
      const token = await node.http.post(LOGIN_ROUTE, {
        email,
        password,
      });
      await setToGlobalContext(node, 'aloesToken', token);
      return token;
    } catch (error) {
      await setToGlobalContext(node, 'aloesToken', undefined);
      const message = 'Login error';
      throw new Error(`${message}: ${error.message}`);
    }
  }

  async function getToken(node, credentials) {
    let token = await getFromGlobalContext(node, 'aloesToken');
    if (!token || !token.id) {
      token = await login(node, credentials);
    }
    return token;
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

    this.usews = config.usews;
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
    if (typeof this.usews === 'undefined') {
      this.usews = false;
    }
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
        this.httpHost,
        this.httpPort,
        this.httpApiRoot,
        prox,
        noprox,
        this.httpSecure,
      );
      this.serverUrl = serverUrl;
      // if (httpOptions) {
      //   this.httpOptions.httpOptions = httpOptions;
      // }
    }

    // Create the URL to pass in to the MQTT.js library
    if (this.brokerUrl === '') {
      const { brokerUrl, wsOptions } = getBrokerUrl(
        this.mqttHost,
        this.mqttPort,
        prox,
        noprox,
        this.mqttSecure,
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

    this.get = async function (aloesNode, url) {
      const { id } = aloesNode;
      node.log(
        RED._('aloes.state.send-request', {
          server: node.serverUrl,
        }),
      );
      node.users[id].status({
        fill: 'yellow',
        shape: 'dot',
        text: 'node-red:common.status.connecting',
      });

      let result;
      try {
        result = await node.http.get(url);
        node.log(
          RED._('aloes.state.response-success', {
            server: node.serverUrl,
          }),
        );
        node.users[id].status({
          fill: 'green',
          shape: 'dot',
          text: 'node-red:common.status.connected',
        });
      } catch (e) {
        node.log(
          RED._('aloes.state.response-error', {
            server: node.serverUrl,
          }),
        );
        node.users[id].status({
          fill: 'red',
          shape: 'ring',
          text: 'node-red:common.status.disconnected',
        });
      } finally {
        return result;
      }
    };

    this.post = async function (aloesNode, url, body) {
      const { id } = aloesNode;
      node.log(
        RED._('aloes.state.send-request', {
          server: node.serverUrl,
        }),
      );
      node.users[id].status({
        fill: 'yellow',
        shape: 'dot',
        text: 'node-red:common.status.connecting',
      });

      let result;
      try {
        result = await node.http.post(url, body);
        node.log(
          RED._('aloes.state.response-success', {
            server: node.serverUrl,
          }),
        );
        node.users[id].status({
          fill: 'green',
          shape: 'dot',
          text: 'node-red:common.status.connected',
        });
      } catch (e) {
        node.log(
          RED._('aloes.state.response-error', {
            server: node.serverUrl,
          }),
        );
        node.users[id].status({
          fill: 'red',
          shape: 'ring',
          text: 'node-red:common.status.disconnected',
        });
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
          node.client.on('error', function (error) {});
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

    this.on('close', function (done) {
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
