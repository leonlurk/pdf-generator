const serverless = require('serverless-http');
const app = require('../server'); // Importamos tu app desde server.js
module.exports.handler = serverless(app);
