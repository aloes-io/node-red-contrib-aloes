const helper = require('node-red-node-test-helper');
const getDevicesNode = require('../get-devices/get-devices.js');

describe('get-devices Node', function () {
  afterEach(function () {
    helper.unload();
  });

  it('should be loaded', function (done) {
    var flow = [{ id: 'n1', type: 'get-devices', name: 'test name' }];
    helper.load(getDevicesNode, flow, function () {
      var n1 = helper.getNode('n1');
      n1.should.have.property('name', 'test name');
      done();
    });
  });

  it('should make payload lower case', function (done) {
    var flow = [
      { id: 'n1', type: 'get-devices', name: 'test name', wires: [['n2']] },
      { id: 'n2', type: 'helper' },
    ];
    helper.load(getDevicesNode, flow, function () {
      var n2 = helper.getNode('n2');
      var n1 = helper.getNode('n1');
      n2.on('input', function (msg) {
        msg.should.have.property('payload', 'uppercase');
        done();
      });
      n1.receive({ payload: 'UpperCase' });
    });
  });
});
