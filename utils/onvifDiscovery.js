import dgram from 'react-native-udp';
import { Buffer } from 'buffer';

export async function discoverOnvifCameras(timeout = 3000) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const probe = `
      <?xml version="1.0" encoding="UTF-8"?>
      <e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope"
        xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing"
        xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"
        xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
        <e:Header>
          <w:MessageID>uuid:${Math.random()}</w:MessageID>
          <w:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>
          <w:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>
        </e:Header>
        <e:Body>
          <d:Probe>
            <d:Types>dn:NetworkVideoTransmitter</d:Types>
          </d:Probe>
        </e:Body>
      </e:Envelope>
    `.replace(/\s+/g, ' ');

    const results = [];
    socket.bind(0, () => {
      socket.setBroadcast(true);
      socket.setMulticastTTL(128);
      socket.addMembership('239.255.255.250');
      socket.send(
        Buffer.from(probe),
        0,
        Buffer.byteLength(probe),
        3702,
        '239.255.255.250'
      );
    });

    socket.on('message', (msg, rinfo) => {
      const xml = msg.toString();
      // ดึง xaddrs, ip, name จาก xml (parse แบบง่าย)
      const xaddrsMatch = xml.match(/<XAddrs>(.*?)<\/XAddrs>/);
      const xaddrs = xaddrsMatch ? xaddrsMatch[1] : '';
      const ip = rinfo.address;
      results.push({
        ip,
        xaddrs,
        name: ip,
        rtsp_url: `rtsp://${ip}:554/Streaming/Channels/101`
      });
    });

    setTimeout(() => {
      socket.close();
      resolve(results);
    }, timeout);
  });
} 