const findDevices = `
query findDevices($apiKey: String!, $ownerId: String!, $deviceLimit: Int!) {
  auth: viewerApiKey(apiKey: $apiKey) {
    devices: findDevices(filter: { limit: $deviceLimit }) {
      accessPointUrl
      apiKey
      clientKey
      createdAt
      description
      devEui
      frameCounter
      icons
      id
      lastSignal
      messageProtocol
      messageProtocolVersion
      name
      ownerId
      # qrCode
      status
      transportProtocol
      transportProtocolVersion
      type
      sensors(
        measurementFilter: {
          limit: 10
          order: ["ASC"]
          # where: { rp: "0s" }
        }
      ) {
        # colors
        description
        devEui
        deviceId
        frameCounter
        icons
        id
        inPrefix
        lastSignal
        messageProtocol
        messageProtocolVersion
        name
        nativeNodeId
        nativeResource
        nativeSensorId
        nativeType
        outPrefix
        ownerId
        resource
        transportProtocol
        transportProtocolVersion
        type
        resources {
          ...findResourcesByType
        }
        #         measurements {
        #           time
        #           value
        #         }
      }
      sensorsCount {
        count
      }
    }
    devicesCount(where: { ownerId: $ownerId }) {
      count
    }
  }
}

fragment findResourcesByType on SensorResources {
  __typename
  ... on Acidity {
    _5601
    _5602
    _5603
    _5604
    _5605
    _5700
    _5701
    _5750
#     _5821
  }
  ... on Actuation {
    _5750
    _5850
    _5851
#     _5852
    _5853
  }
  ... on Accelerometer {
    _5603
    _5604
    _5701
    _5702
    _5703
    _5704
  }
  ... on AddressableTextDisplay {
    _5527
    _5528
    _5529
    _5530
    _5531
    _5545
    _5546
    _5548
    _5750
    _5850
  }
  ... on Altitude {
    _5601
    _5602
    _5603
    _5604
    _5700
    _5701
    _5750
#     _5821
  }
  ... on AnalogInput {
    _5600
    _5601
    _5602
    _5603
    _5604
    _5605
    _5750
  }
  ... on AnalogOutput {
    _5603
    _5604
    _5650
    _5750
  }
  ... on AudioClip {
    _5522
    _5523
    _5524
    _5548
    _5750
  }
  ... on Barometer {
    _5601
    _5602
    _5603
    _5604
    _5605
    _5700
    _5701
  }
  ... on Bitmap {
    _5750
    _5910
    _5911
    _5912
  }
  ... on Buzzer {
    _5521
    _5525
    _5548
    _5750
    _5850
  }
  ... on Color {
    _5701
    _5706
    _5750
  }
  ... on Conductivity {
    _5601
    _5602
    _5603
    _5604
    _5605
    _5700
    _5701
    _5750
#     _5821
  }
  ... on Concentration {
    _5601
    _5602
    _5603
    _5604
    _5605
    _5700
    _5701
    _5750
#     _5821
  }
  ... on Current {
    _5601
    _5602
    _5603
    _5604
    _5605
    _5700
    _5701
    _5750
#     _5821
  }
  ... on Depth {
    _5601
    _5602
    _5603
    _5604
    _5605
    _5700
    _5701
    _5750
#     _5821
  }
  ... on Distance {
    _5601
    _5602
    _5603
    _5604
    _5605
    _5700
    _5701
    _5750
#     _5821
  }
  ... on Direction {
    _5601
    _5602
    _5605
    _5705
    _5750
  }
  ... on DigitalInput {
    _5500
    _5501
    _5502
    _5503
    _5504
    _5505
    _5750
    _5751
  }
  ... on DigitalOutput {
    _5550
    _5551
    _5750
  }
  ... on Energy {
    _5701
    _5750
    _5805
    _5822
  }
  ... on Frequency {
    _5601
    _5602
    _5603
    _5604
    _5605
    _5700
    _5701
    _5750
#     _5821
  }
  ... on Gyrometer {
    _5508
    _5509
    _5510
    _5511
    _5512
    _5513
    _5603
    _5604
    _5605
    _5701
    _5702
    _5703
    _5704
    _5750
  }
  ... on GpsLocation {
    _5514
    _5515
    _5516
    _5517
    _5518
    _5705
  }
  ... on GenericSensor {
    _5601
    _5602
    _5603
    _5604
    _5605
    _5700
    _5701
    _5750
    _5751
  }
  ... on HandoverEvent {
    _3
    _4
    _6032
    _6033
  }
  ... on HumiditySensor {
    _5601
    _5602
    _5603
    _5604
    _5605
    _5700
    _5701
  }
  ... on IlluminanceSensor {
    _5601
    _5602
    _5603
    _5604
    _5605
    _5700
    _5701
  }
  ... on LevelControl {
    _5548
    _5750
    _5852
    _5854
  }
  ... on LightControl {
    _5701
    _5706
    _5750
    _5805
    _5820
    _5850
    _5851
    _5852
  }
  ... on Load {
    _5601
    _5602
    _5603
    _5604
    _5605
    _5700
    _5701
    _5750
#     _5821
  }
  ... on Loudness {
    _5601
    _5602
    _5603
    _5604
    _5605
    _5700
    _5701
    _5750
#     _5821
  }
  ... on LoadControl {
    _5750
    _5823
    _5824
    _5825
    _5826
    _5827
    _5828
  }
  ... on Magnetometer {
    _5701
    _5702
    _5703
    _5704
    _5705
  }
  ... on MultipleAxisJoystick {
    _5500
    _5501
    _5702
    _5703
    _5704
    _5750
  }
  ... on MultistateSelector {
    _5547
    _5750
  }
  ... on OnOffSwitch {
    _5500
    _5501
    _5750
    _5852
    _5854
  }
  ... on Percentage {
    _5601
    _5602
    _5603
    _5604
    _5605
    _5700
    _5701
    _5750
#     _5821
  }
  ... on Positioner {
    _5519
    _5520
    _5536
    _5537
    _5538
    _5601
    _5602
    _5605
    _5750
  }
  ... on Power {
    _5601
    _5602
    _5603
    _5604
    _5605
    _5700
    _5701
    _5750
#     _5821
  }
  ... on PowerControl {
    _5750
    _5805
    _5820
    _5850
    _5851
    _5852
  }
  ... on PowerFactor {
    _5601
    _5602
    _5603
    _5604
    _5605
    _5700
    _5701
    _5750
#     _5821
  }
  ... on PowerMeasurment {
    _5605
    _5800
    _5801
    _5802
    _5803
    _5804
    _5805
  }
  ... on PowerupLog {
    _1
    _2
    _3
    _4
    _10
  }
  ... on PresenceSensor {
    _5500
    _5501
    _5505
    _5751
    _5903
    _5904
  }
  ... on Pressure {
    _5601
    _5602
    _5603
    _5604
    _5605
    _5700
    _5701
    _5750
#     _5821
  }
  ... on PushButton {
    _5500
    _5501
    _5750
  }
  ... on Rate {
    _5601
    _5602
    _5603
    _5604
    _5605
    _5700
    _5701
    _5750
#     _5821
  }
  ... on RadioLinkFailureEvent {
    _1
  }
  ... on SetPoint {
    _5701
    _5706
    _5750
    _5900
  }
  ... on Stopwatch {
    _5501
    _5544
    _5750
    _5850
  }
  ... on TemperatureSensor {
    _5601
    _5602
    _5603
    _5604
    _5605
    _5700
    _5701
  }
  ... on Time {
    _5506
    _5507
    _5750
  }
  ... on Timer {
    _5501
    _5521
    _5523
    _5525
    _5526
    _5534
    _5538
    _5543
    _5544
    _5750
    _5850
  }
  ... on UpDownControl {
    _5532
    _5533
    _5541
    _5542
    _5750
  }
  ... on Voltage {
    _5601
    _5602
    _5603
    _5604
    _5605
    _5700
    _5701
    _5750
#     _5821
  }
}

`;

module.exports = {
  findDevices,
};
