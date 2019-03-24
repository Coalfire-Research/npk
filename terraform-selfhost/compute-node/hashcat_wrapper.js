/*jshint esversion: 6 */
/*jshint node: true */

"use strict";

var fs = require('fs');
var os = require('os');
var aws = require('aws-sdk');
var pty = require('node-pty');
var apiClientFactory = require('aws-api-gateway-client').default;

var buffer = "";
var retrigger = "";
var ptyProcess = {};
var credentialsReady = 0;

var region = fs.readFileSync('/root/region', 'ascii').trim();
var manifest = JSON.parse(fs.readFileSync('/root/manifest.json'));
var keyspace = parseInt(fs.readFileSync('/root/keyspace'));
var apigateway = fs.readFileSync('/root/apigateway', 'ascii').trim();
var manifestpath = fs.readFileSync('/root/manifestpath', 'ascii').trim();
var instance_id = fs.readFileSync('/root/instance_id', 'ascii').trim();
var instance_count = parseInt(fs.readFileSync('/root/instance_count'));
var instance_number = parseInt(fs.readFileSync('/root/instance_number'));

var apiClient = null;

function getHashcatParams(manifest) {

	var limit = Math.ceil(keyspace / instance_count);
	var skip = limit * (instance_number - 1);

	var params = [
		"--quiet",
		"-O",
		"--remove",
		"--potfile-path=/potfiles/" + instance_id + ".potfile",
		"-o",
		"/potfiles/cracked_hashes-" + instance_id + ".txt",
		"-w",
		"4",
		"-m",
		manifest.hashType,
		"-a",
		manifest.attackType,
	];

	if (instance_count > 1) {
		params.push("--skip");
		params.push(skip);
	}

	if (instance_number != instance_count) {
		params.push("--limit");
		params.push(limit);
	}

	if (manifest.attackType == 0) {
		fs.readdirSync('/root/npk-rules/').forEach(function(e) {
			params.push("-r");
			params.push("/root/npk-rules/" + e);
		});
	}

	params.push("/root/hashes.txt");

	if ([0,6].indexOf(manifest.attackType) >= 0) {
		params.push("/root/npk-wordlist/" + fs.readdirSync("/root/npk-wordlist/")[0]);
	}

	if ([3,6].indexOf(manifest.attackType) >= 0) {
		params.push(manifest.mask);
	}

	return params;
}

function runHashcat(params) {
	return new Promise((success, failure) => {
		ptyProcess = pty.spawn("/root/hashcat/hashcat64.bin", params, {
			name: 'xterm-color',
			cols: 80,
			rows: 30,
			cwd: process.env.HOME,
			env: process.env
		});

		ptyProcess.on('data', function(data) {
			readOutput(data);
		});

		ptyProcess.on('exit', function(code, signal) {

			unmonitorStatus();
			if (code == 1) {
				console.log("\n\nCracking job exited successfully.\n");
			} else {
				console.log("\n\nDied with code " + code + " and signal " + signal + "\n");
				console.log("Dying words:");
				console.log(buffer);
				console.log("\n\n");
			}	

			return success(code);
		});

		setTimeout(function() {
			outputBuffer = "";
			monitorStatus();
		}, 10000);
	});
}

var monitorStatus = function() {
	ptyProcess.write('s');

	retrigger = setTimeout(monitorStatus, 60000);
};

var unmonitorStatus = function() {
	clearTimeout(retrigger);
};

var credFailureCount = 0;
var getCredentials = function() {
	return new Promise((success, failure) => {
		aws.config.getCredentials(function(err) {
			if (err) {
				credFailureCount++;
				console.log("Error retrieving credentials:" + err);

				if (credFailureCount < 5) {
					console.log("Retrying");
					return getCredentials();
				} else {
					return Project.reject('Failure retrieving credentials.')
				}
			}

			credentialsReady = 1;

			apiClient = apiClientFactory.newClient({
				invokeUrl: "https://" + apigateway + "/v1/statusreport/",
				accessKey: aws.config.credentials.accessKeyId,
				secretKey: aws.config.credentials.secretAccessKey,
				sessionToken: aws.config.credentials.sessionToken,
				region: "us-west-2"
			});

			setTimeout(getCredentials, 600);

			return success(true);
		});
	});
};

var sendStatusUpdate = function (body) {
	var pathTemplate = "{userid}/{campaign}/{instance_id}/{action}";
	var pathParams = {
		userid: manifestpath.split('/')[0],
		campaign: manifestpath.split('/')[2],
		instance_id: instance_id,
		action: 'performance'
	};

	return new Promise((success, failure) => {
		if (credentialsReady == 0) {
			console.log("Can't deliver status update. Credentials aren't ready.");
			return failure(false);
		}

		apiClient.invokeApi(pathParams, pathTemplate, "POST", {}, body).then(function(result) {
			console.log("Status Update sent.");
			success(true);
		}).catch(function(err) {
			// console.error(err.response.statusCode);
			console.error(err.response.data);
			failure(false);
		});
	});
};

var sendFinished = function (completed) {
	var nodeTemplate = "{userid}/{campaign}/{instance_id}/{action}";
	var nodeParams = {
		userid: manifestpath.split('/')[0],
		campaign: manifestpath.split('/')[2],
		instance_id: instance_id,
		action: 'done'
	};

	return new Promise((success, failure) => {
		if (credentialsReady == 0) {
			console.log("Can't deliver status update. Credentials aren't ready.");
			return failure(false);
		}

		var recoveredHashes;
		try {
			recoveredHashes = fs.readFileSync("/potfiles/cracked_hashes-" + instance_id + ".txt", "ascii").trim().split("\n").length || 0;	
		} catch (e) {
			recoveredHashes = 0;
		}

		apiClient.invokeApi(nodeParams, nodeTemplate, "POST", {}, {completed: completed, recoveredHashes: recoveredHashes}).then(function(result) {
			console.log("Node marked as complete.");
			success(true);
		}).catch(function(err) {
			// console.error(err.response.statusCode);
			console.error(err.response.data);
			failure(false);
		});
	});
};

var outputBuffer = "";
var readOutput = function(output) {

	// Wrap in a try/catch to make failures non-fatal.
	try {
		outputBuffer += output;
		if (outputBuffer.length < 200 || outputBuffer.slice(-4) != "\r\n\r\n") {
			outputBuffer += output;
			return false;
		}

		console.log("Found status report in output");
		console.log(outputBuffer);

		output = outputBuffer;
		outputBuffer = "";
		// console.log(output.slice(-1));
		var lines = output.split("\n");

		var speed = 0;
		output = {};
		var gpuKeys = {};
		lines.forEach(function(e) {
			if (e.indexOf('.: ') < 0) {
				return true;
			}

			var fields = (e.split('.: '));

			var label = fields[0].replace(/\.*$/, '');
			var value = fields[1].trim();

			//Handle 'speed' entries here, since there's no better way.
			if (/Speed.#\d/.test(label)) {
				gpuKeys[label.slice(7)] = true;
				var number = parseFloat(value.split(' ')[0]);
				var multiplier = value.split(' ')[1].toLowerCase();

				switch (multiplier) {
					case "h/s":
						number *= 1;
					break;

					case "kh/s":
						number *= 1000;
					break;

					case "mh/s":
						number *= 1000000;
					break;

					case "gh/s":
						number *= 1000000000;
					break;

					default:
						number *= 1;
					break;
				}

				output[label + '.Hz'] = number;
				speed += number;
			}

			output[label] = value;
		});


		output.startTime = (Date.parse(output['Time.Started']) / 1000).toFixed(0);
		output.estimatedEndTime = (Date.parse(output['Time.Estimated']) / 1000).toFixed(0);

		output.hashRate = speed;

		var progress = output.Progress.split(' ')[0].split('/');
		output.progress = (progress[0] / progress[1] * 100).toFixed(6);

		var recovered = output.Recovered.split(' ')[0].split('/');
		output.recoveredHashes = recovered[0];
		output.recoveredPercentage = (recovered[0] / recovered[1] * 100).toFixed(6);

		var rejected = output.Rejected.split(' ')[0].split('/');
		output.rejectedPercentage = (rejected[0] / rejected[1] * 100).toFixed(6);

		output.performance = {};
		Object.keys(gpuKeys).forEach(function(i) {
			output.performance[Object.keys(output.performance).length] = output['Speed.#' + i + ".Hz"];
		});

		return sendStatusUpdate({
			startTime: output.startTime,
			estimatedEndTime: output.estimatedEndTime,
			hashRate: output.hashRate,
			progress: output.progress,
			recoveredHashes: output.recoveredHashes,
			recoveredPercentage: output.recoveredPercentage,
			rejectedPercentage: output.rejectedPercentage,
			performance: output.performance,
		});
	} catch (e) {
		console.log("Caught error: " + e);
	}
};

getCredentials().then((data) => {
	console.log('Credentials loaded');
	var params = getHashcatParams(manifest);

	console.log(params);
	runHashcat(params).then((data) => {
		if (data == 1) {
			return sendFinished(true);
		} else {
			return sendFinished(false);
		}
	}).then((data) => {
		process.exit(0);
	}).catch((err) => {
		console.log(err);
		process.exit(0);
	});
}).catch((err) => {
	return sendFinished(false);
});

/*
exports.readOutput = readOutput;
exports.sendStatusUpdate = sendStatusUpdate;
*/