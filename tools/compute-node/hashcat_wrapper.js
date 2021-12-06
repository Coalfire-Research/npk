/*jshint esversion: 6 */
/*jshint node: true */

"use strict";

var fs = require('fs');
var os = require('os');
var aws = require('aws-sdk');
const { spawn } = require('child_process');
var apiClientFactory = require('aws-api-gateway-client').default;

var region = process.env.REGION;
var primaryRegion = process.env.USERDATAREGION;
var keyspace = process.env.KEYSPACE || 1;
var apigateway = process.env.APIGATEWAY;
var manifestpath = process.env.ManifestPath;

var instance_id = process.env.INSTANCEID;
var instance_count = process.env.INSTANCECOUNT || 1;
var instance_number = process.env.INSTANCENUMBER || 1;

var manifest = JSON.parse(fs.readFileSync('/root/manifest.json'));

var apiClient = null;
var credentialsReady = 0;
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
				region: primaryRegion
			});

			setTimeout(getCredentials, 600);

			return success(true);
		});
	});
};

function getHashcatParams(manifest) {

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
		"--status",
		"--status-json",
		"--status-timer",
		"30"
	];

	if (manifest.manualArguments) {
		console.log("Adding manual arguments:", manifest.manualArguments.split(" "));
		params = params.concat(manifest.manualArguments.split(" "));
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
		if (manifest.manualMask) {
			params.push(manifest.manualMask);
		} else {
			params.push(manifest.mask);
		}
	}

	return getKeyspace(params);
}

var readOutput = function(output) {

	try {
		var status = JSON.parse(output);
	} catch (e) {
		return false;
	}
		
	// console.log("Found status report in output");
	// console.log(status);

	var hashrate = 0;
	var performance = {};
	status.devices.forEach(function(device) {
		hashrate += device.speed;
		performance[device.device_id] = device.speed;
	});

	console.log(((status.progress[0] / status.progress[1]) * 100).toFixed(2) + "% finished @ " + hashrate.toLocaleString() + "H/s");

	return sendStatusUpdate({
		startTime: status.time_start,
		estimatedEndTime: status.estimated_stop,
		hashRate: hashrate,
		progress: ((status.progress[0] / status.progress[1]) * 100).toFixed(2),
		hashes: status.recovered_hashes[1],
		recoveredHashes: status.recovered_hashes[0],
		recoveredPercentage: ((status.recovered_hashes[0] / status.recovered_hashes[1]) * 100).toFixed(2),
		rejectedPercentage: ((status.rejected / status.progress[0]) * 100).toFixed(2),
		performance: performance
	});
};

function getKeyspace(params) {
	return new Promise((success, failure) => {
		console.log("Determining keyspace...");

		// replaces the hashfile with '--keyspace'
		var keyspaceIndex = params.indexOf("/root/hashes.txt") - params.length;
		params.splice(keyspaceIndex, 1, "--keyspace");

		const hashcat = spawn("/root/hashcat/hashcat.bin", params, {
			name: 'xterm-color',
			cols: 80,
			rows: 30,
			cwd: process.env.HOME,
			env: process.env
		});

		var output = "";
		hashcat.stdout.on('data', function(data) {
			console.log("1> " + data.toString().replace("\n", ""));
			output += data;
		});

		hashcat.stderr.on('data', function(data) {
			console.log("2> " + data);
		});

		hashcat.on('exit', function(code, signal) {

			console.log(" ");
			output = output.split("\n").splice(-2, 1);

			if (output / 1 == output) {
				var limit = Math.ceil(output / instance_count);
				var skip = limit * (instance_number - 1);

				console.log("Got keyspace [ " + output.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,') + " ].");
				console.log("As node [ " + instance_number + " ] of [ " + instance_count + " ] I'll skip [ " + skip.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,') + " ]." );

				//Put the hashfile back.
				params.splice(keyspaceIndex, 1, "/root/hashes.txt");

				if (instance_count > 1) {
					params.splice(keyspaceIndex, 0, "--skip");
					params.splice(keyspaceIndex, 0, skip);
				}

				if (instance_number != instance_count) {
					params.splice(keyspaceIndex, 0, "--limit");
					params.splice(keyspaceIndex, 0, limit);
				}

				return success(params);
			} else {
				return failure(output);
			}
		});
	});
}

function runHashcat(params) {
	return new Promise((success, failure) => {
		console.log("\n\nEverything looks good. Starting hashcat...");
		const hashcat = spawn("/root/hashcat/hashcat.bin", params, {
			name: 'xterm-color',
			cols: 80,
			rows: 30,
			cwd: process.env.HOME,
			env: process.env
		});

		var output = "";
		hashcat.stdout.on('data', function(data) {
			readOutput(data);
			output += data;
			output = output.split("\n").pop();
		});

		hashcat.stderr.on('data', function(data) {
			console.log("Hashcat stderr: " + data);
		});

		hashcat.on('exit', function(code, signal) {

			/* 	Only treating negative numbers as actual errors, based on:
				https://github.com/hashcat/hashcat/blob/master/docs/status_codes.txt	*/

			if (code > -1) {
				console.log("\n\nCracking job exited successfully.\n");
				return success(sendFinished(true));
			}

			console.log("\n\nDied with code " + code + " and signal " + signal + "\n");
			if (output.length > 0) {
				console.log("Dying words:");
				console.log(output);
			}

			console.log("\n\n");
			
			return success(sendFinished(false));
		});
	});
}

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
			console.log("Status update sent.");
			success(true);
		}).catch(function(err) {
			// console.error(err.response.statusCode);
			console.log("Error sending status update to API Gateway");
			console.error(err);
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
		if (fs.existsSync("/potfiles/cracked_hashes-" + instance_id + ".txt")) {
			try {
				recoveredHashes = fs.readFileSync("/potfiles/cracked_hashes-" + instance_id + ".txt", "ascii").trim().split("\n").length || 0;	
			} catch (e) {
				console.log("Unable to read potfile:", e);
				console.log("Sending a recoveredHashes value of 0");
				recoveredHashes = 0;
			}
		} else {
			console.log("Hashcat didn't create a potfile. No hashes were recovered.");
			console.log("Sending a recoveredHashes value of 0");
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

getCredentials().then((data) => {
	console.log('Credentials loaded');
	return getHashcatParams(manifest)
}, (e) => {
	console.log("Fatal error retrieving credentials.", e);
	process.exit();
}).then((params) => {
	console.log('Hashcat parameters:', params)
	return runHashcat(params);
}, (e) => {
	console.log("Fatal error determining keyspace.", e);
	process.exit();
}).then((data) => {	
	console.log("Final update delivered.");
	process.exit();
}, (e) => {
	console.log("Error delivering final update.", e);
	process.exit();
});