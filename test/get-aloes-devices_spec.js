const helper = require('node-red-node-test-helper');
const should = require('should');
const getAloesDevicesNode = require('../get-aloes-devices/get-aloes-devices.js');
// const aloesConfig = require('../aloes-config/aloes-config.js');
const { devices, start, stop } = require('./server.js');
helper.init(require.resolve('node-red'));

const httpPort = 8000;
const mqttPort = 1883;

describe('get-devices Node', function () {
  const conf = {
    httpHost: 'localhost',
    httpPort,
    httpApiRoot: '/api',
    httpSecure: false,
    mqttHost: 'localhost',
    mqttPort,
    mqttSecure: false,
  };

  const credentials = {
    email: 'test@test.test',
    password: 'test',
    token: '',
  };

  before(function (done) {
    start(httpPort, mqttPort)
      .then(() => helper.startServer(done))
      .catch((e) => done(e));
  });

  after(function (done) {
    stop()
      .then(() => helper.stopServer(done))
      .catch((e) => done(e));
  });

  afterEach(function () {
    helper.unload();
  });

  // it('should not be loaded without config', function (done) {
  //   const flow = [{ id: 'n1', type: 'get-aloes-devices', name: 'test name' }];
  //   helper.load(getAloesDevicesNode, flow, function () {
  //     const n1 = helper.getNode('n1');
  //     // helper.log('should not be loaded without config', n1);
  //     n1.should.have.property('name', 'test name');
  //     done();
  //   });
  // });

  it('should be loaded', function (done) {
    const flow = [
      { id: 'n1', type: 'aloes-config', name: 'aloes-test', ...conf, credentials },
      { id: 'n2', type: 'get-aloes-devices', name: 'test name', aloesConfig: 'n1' },
    ];

    helper.load(getAloesDevicesNode, flow, credentials, function () {
      const n2 = helper.getNode('n2');
      console.log('should be loaded', { n2 });

      n2.should.have.property('name', 'test name');
      done();
    });
  });

  it('should get devices from aloes', function (done) {
    const flow = [
      { id: 'n1', type: 'aloes-config', name: 'aloes-test', ...conf, credentials },
      {
        id: 'n3',
        type: 'get-aloes-devices',
        name: 'test name',
        aloesConfig: 'n1',
        wires: [['n4']],
      },
      { id: 'n4', type: 'helper' },
    ];

    helper.load(getAloesDevicesNode, flow, function () {
      const n3 = helper.getNode('n3');
      const n4 = helper.getNode('n4');
      console.log('should get devices from aloes', n3);

      n4.on('input', function (msg) {
        msg.should.have.property('payload', devices);
        done();
      });
      n3.receive({ payload: true });
    });
  });
});
