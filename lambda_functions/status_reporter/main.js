/*jshint esversion: 6 */
/*jshint node: true */

"use strict";

var fs 			= require('fs');
var aws			= require('aws-sdk');
var uuid		= require('uuid/v4');
var ddbTypes 	= require('dynamodb-data-types').AttributeValue;
var settings = JSON.parse(JSON.stringify(process.env));

var cb = "";
var lambdaEvent = {};

aws.config.apiVersions = {
	dynamodb: 	'2012-08-10'
};

aws.config.update({region: settings.region});

var db = new aws.DynamoDB();

Object.prototype.require = function (elements) {
	var self = this;

	var result = true;
	Object.keys(elements).forEach(function (e) {
		if (typeof self[e] == "undefined") {
			return respond(417, {msg: 'Object state assertion failed: ' + e + ' does not exist.', object: self}, false);
		}

		if (typeof elements[e] == "object") {
			result = self[e].require(elements[e]);
		}
	});
};

function editCampaign(entity, rangeKey, values) {
	return new Promise((success, failure) => {
		values = ddbTypes.wrap(values);

		Object.keys(values).forEach(function(e) {
			values[e] = {
				Action: "PUT",
				Value: values[e]
			};
		});

		var ddbParams = {
			Key: {
				userid: {S: entity},
				keyid: {S: rangeKey}
			},
			TableName: "Campaigns",
			AttributeUpdates: values
		};

		// console.log(JSON.stringify(ddbParams));

		db.updateItem(ddbParams, function (err, data) {
			if (err) {
				return failure(respond(500, "Error updating table: " + err, false));
			}

			return success(data);
		});
	});
}

function putStatusReport(user, campaign, node, stats) {

	let campaignKey = [
		"campaigns",
		campaign
	].join(':');

	let setHashes = editCampaign(user, campaignKey, {
		hashes: stats.hashes
	}).then(function(data) {
		return respond(201, {campaign: campaign, node: node, time: lambdaEvent.requestContext.requestTimeEpoch}, true);
	}, function (err) {
		return respond(500, "Failed to post update; " + err, false);
	});

	var rangeKey = [
		campaign,
		"nodes",
		node,
		(lambdaEvent.requestContext.requestTimeEpoch / 1000).toFixed(0)
	].join(':');

	let status = editCampaign(user, rangeKey, {
		startTime: stats.startTime,
		estimatedEndTime: stats.estimatedEndTime,
		hashRate: stats.hashRate,
		progress: stats.progress,
		hashes: stats.hashes,
		recoveredHashes: stats.recoveredHashes,
		rejectedPercentage: stats.rejectedPercentage,
		performance: stats.performance,
		status: "ACTIVE"
	}).then(function(data) {
		return respond(201, {campaign: campaign, node: node, time: lambdaEvent.requestContext.requestTimeEpoch}, true);
	}, function (err) {
		return respond(500, "Failed to post update; " + err, false);
	});

	return Promise.all([setHashes, status]);
}

function putNode(user, campaign, node, body) {

	body.require({
		completed: 0,
		recoveredHashes: 0
	});

	var rangeKey = [
		campaign,
		"nodes",
		node,
		(lambdaEvent.requestContext.requestTimeEpoch / 1000).toFixed(0)
	].join(':');

	var params = {};
	if (body.completed == 1) {
		params = {
			eventType: "NodeFinished",
			status: 'COMPLETED',
			progress: 100,
			recoveredHashes: body.recoveredHashes,
			startTime: (lambdaEvent.requestContext.requestTimeEpoch / 1000).toFixed(0)
		};
	} else {
		params = {
			eventType: "NodeFinished",
			status: 'ERROR',
			startTime: (lambdaEvent.requestContext.requestTimeEpoch / 1000).toFixed(0)
		};
	}

	editCampaign(user, rangeKey, params).then(function(data) {
		return respond(201, {campaign: campaign, node: node, time: lambdaEvent.requestContext.requestTimeEpoch}, true);
	}, function (err) {
		return respond(500, "Failed to post update; " + err, false);
	});
}


function invalidMethod(path, method) {
	return respond(418, "Teapots can't do that." + JSON.stringify(arguments), false);
}

function processHttpRequest(path, method, entity, body) {
	var params = path.split("/");

	switch (method) {
		case "POST":
			switch (params[3]) {
				case "performance":
					body.require({
						startTime: 0,
						estimatedEndTime: 0,
						hashRate: 0,
						progress: 0,
						hashes: 0,
						recoveredHashes: 0,
						rejectedPercentage: 0,
						performance: 0
					});

					return putStatusReport(decodeURIComponent(params[0]), params[1], params[2], body);
				break;

				case "done":
					body.require({
						completed: 0
					});

					return putNode(decodeURIComponent(params[0]), params[1], params[2], body);
				break;

				default:
					return invalidMethod(path, method);
				break;
			}
		break;

		default:
			return invalidMethod(path, method);
		break;
	}

	return respond(404, "Not found.", false)
}

function respond(statusCode, body, success) {

	var headers = {'Content-Type': 'text/plain'};

	switch (typeof body) {
		case "string":
			body = { msg: body, success: success };
		break;

		case "object":
			body.success = success;
		break;
	}

	return cb(null, {
		statusCode: statusCode,
		headers: headers,
		body: JSON.stringify(body),
	});
}

exports.main = function(event, context, callback) {

	// Hand off the callback function for later.
	cb = callback;
	lambdaEvent = event;

	/*
	var allowed_characters = /^[a-zA-Z0-9'"%\.\[\]\{\}\(\)\-\:\\\/\;\=\?\#\_+\s,&]+$/;
	if (!allowed_characters.test(JSON.stringify(event))) {
		return respond(400, "Illegal request", false);
	}
	*/

	// Try/Catch the whole thing. Cause why not.
	try {

		event.require({
			"body": 0,
			"isBase64Encoded": 0,
			"httpMethod": 0,
			"pathParameters": {
				"proxy": 0
			},
			"queryStringParameters": 0,
			"requestContext": {
				"requestId": 0,
				"identity": {
					"caller": 0
				},
				"requestTimeEpoch": 0
			}
		});

		if (event.requestContext.identity.user == null) {
			return respond(401, "Authentication Required", false);
		}

		var body = {};
		// Unencode the body if necessary
		if (event.body != null) {
			
			// Body will always be a JSON object.
			try {
				body = JSON.parse(event.body);
			} catch (e) {
				return respond(400, "Body must be JSON object", false);
			}
		}

		// Process the request
		return processHttpRequest(event.pathParameters.proxy, event.httpMethod, event.requestContext.identity.cognitoIdentityId, body);

	} catch (e) {
		console.log(e);
		respond(500, "Unknown Error", false);
	}
};