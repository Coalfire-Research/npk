/*jshint esversion: 6 */
/*jshint node: true */

"use strict";

var fs = require('fs');
var pty = require('node-pty');

try {
	fs.unlinkSync('/root/npk-rules/npk-maskprocessor.rule');
} catch (e) { /* dgaf */ }

try {
	var manifest = JSON.parse(fs.readFileSync('/root/manifest.json'));

	var params = [
		"-o",
		"/root/npk-rules/npk-maskprocessor.rule",
		manifest.mask.split('?').join(' $?').slice(1)
	];

	if (manifest.rulesFiles.length > 0 && manifest.mask.length > 0) {
		var ptyProcess = pty.spawn("/root/maskprocessor/mp64.bin", params, {
			name: 'xterm-color',
			cols: 80,
			rows: 30,
			cwd: process.env.HOME,
			env: process.env
		});

		ptyProcess.on('data', function(data) {
			console.log(data);
		});

		ptyProcess.on('exit', function(code, signal) {

			fs.appendFileSync('/root/npk-rules/npk-maskprocessor.rule', "\n:");
			console.log("Maskprocessor finished with code " + code);

			process.exit(0);
		});
	} else {
		console.log("Skipping maskprocessor");
	}
} catch(e) { /* Blackhole */}