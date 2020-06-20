const express = require('express');

const aedes = require('aedes')();
const broker = require('net').createServer(aedes.handle);

const app = express();

let httpServer;

const users = [{ email: 'test@test.test', password: 'test' }];

const fakeToken = { id: '1234', userId: '5678' };

const devices = [
  {
    id: '1234',
    name: 'device-1',
    type: 'fake-device',
    sensors: [{ id: '5432', name: 'switch', type: 3342, deviceId: '1234' }],
  },
  {
    id: '5678',
    name: 'device-1',
    type: 'fake-device',
    sensors: [{ id: '9876', name: 'temperature', type: 3303, deviceId: '5678' }],
  },
];

app.get('/api/Users/login', (req, res) => {
  console.log('/api/Users/login', users);

  res.json(fakeToken);
});

app.get('/api/Devices', (req, res) => {
  console.log('/api/Devices');

  res.json(devices);
});

const startServer = (httpPort) =>
  new Promise((resolve, reject) => {
    httpServer = app.listen(httpPort, (err) => {
      if (err) reject(err);
      else {
        console.log(`Server started and listening on ${httpPort}`);
        resolve();
      }
    });
  });

const startBroker = (mqttPort) =>
  new Promise((resolve, reject) => {
    broker.listen(mqttPort, (err) => {
      if (err) reject(err);
      else {
        console.log(`Broker started and listening on port ${mqttPort}`);
        resolve();
      }
    });
  });

const closeServer = () =>
  new Promise((resolve, reject) => {
    httpServer.close((err) => {
      if (err) reject(err);
      else {
        console.log(`Server closed`);
        resolve();
      }
    });
  });

const closeBroker = () =>
  new Promise((resolve, reject) => {
    broker.close((err) => {
      if (err) reject(err);
      else {
        console.log(`Broker closed`);
        resolve();
      }
    });
  });

const start = async (httpPort, mqttPort) => {
  console.log('Starting server and broker...');
  await startServer(httpPort);
  return startBroker(mqttPort);
};

const stop = async () => {
  console.log('Stoping server and broker...');
  await closeServer();
  return closeBroker();
};

module.exports = { devices, fakeToken, start, stop };
