'use strict';

var crc32 = require('buffer-crc32');

console.log(crc32.unsigned('"name": "Austin–Bergstrom International Airport",'));
console.log(crc32.unsigned('"name": "Austin-Bergstrom International Airport",'));


