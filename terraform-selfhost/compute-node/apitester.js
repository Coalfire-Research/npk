/*jshint esversion: 6 */
/*jshint node: true */

"use strict";

var fs = require('fs');
var hop = require('./hashcat_wrapper');

var ex = fs.readFileSync('example_output.txt', 'ascii');
var output = hop.readOutput(ex);

setTimeout(function() {
	hop.sendStatusUpdate(output).then((data) => {
		process.exit(0);
	});
}, 300);