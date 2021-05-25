/**
 * Copyright 2015 Atsushi Kojo.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function (RED) {
  'use strict';
  const ftp = require('ftp');

  function FtpNode(n) {
    RED.nodes.createNode(this, n);
    const credentials = RED.nodes.getCredentials(n.id);
    this.options = {
      'host': n.host || 'localhost',
      'port': n.port || 21,
      'secure': n.secure || false,
      'secureOptions': n.secureOptions,
      'user': n.user || 'anonymous',
      'password': credentials.password || 'anonymous@',
      'connTimeout': n.connTimeout || 10000,
      'pasvTimeout': n.pasvTimeout || 10000,
      'keepalive': n.keepalive || 10000
    };
  }

  RED.nodes.registerType('ftp', FtpNode, {
    credentials: {
      password: { type: 'password' }
    }
  });

  function FtpInNode(n) {

    RED.nodes.createNode(this, n);

    this.ftp           = n.ftp;
    this.operation     = n.operation;
    this.filename      = n.filename;
    this.localFilename = n.localFilename;
    this.ftpConfig     = RED.nodes.getNode(this.ftp);

    if (!this.ftpConfig) {
      return this.error('missing ftp configuration');
    }

    const node = this;
    node.on('input', (msg) => {

      const conn = new ftp();
      const filename = node.filename || msg.filename || '';
      const localFilename = node.localFilename || msg.localFilename || '';

      this.sendMsg = async (err, result) => {
        if (err) {
          node.error(err, msg);
          node.status({ fill: 'red', shape: 'ring', text: 'failed' });
          node.send(err);
          return;
        }
        node.status({});
        if (node.operation === 'get') {

          const chunks = [];
          for await (const chunk of result) {
            chunks.push(chunk);
          }

          msg.payload = Buffer.concat(chunks);
          msg.message = 'Get operation successful. ' + localFilename;
        } else if (node.operation === 'put') {
          msg.message = 'Put operation successful.';
        } else {
          msg.message = 'Operation successful.';
          msg.payload = result;
        }

        conn.end();

        msg.filename      = filename;
        msg.localFilename = localFilename;

        node.send(msg);

      };

      conn.on('ready', () => {
        switch (node.operation) {
          case 'list':
            conn.list(filename, node.sendMsg);
            break;
          case 'get':
            conn.get(filename, node.sendMsg);
            break;
          case 'put':
            conn.put(localFilename, filename, node.sendMsg);
            break;
          case 'delete':
            conn.delete(filename, node.sendMsg);
            break;
        }
      });

      conn.on('error', (err) => {
        node.error(err, msg);
        node.status({ fill: 'red', shape: 'ring', text: err.message });
        node.send(err);
      });

      conn.connect(node.ftpConfig.options);

    });
  }

  RED.nodes.registerType('ftp in', FtpInNode);
}
