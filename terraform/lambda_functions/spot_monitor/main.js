/*jshint esversion: 6 */
"use strict";

var cb = "";
var aws	= require('aws-sdk');
var settings = require('./npk_settings');
var ddbTypes 	= require('dynamodb-data-types').AttributeValue;

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
			return cb('Object state assertion failed: ' + e + ' does not exist.');
		}

		if (typeof elements[e] == "object") {
			result = self[e].require(elements[e]);
		}
	});
}

var calculateSpotCosts = function(region, spotInstance) {
	var prices = knownSpotPrices[region + ':' + spotInstance.LaunchSpecification.InstanceType][spotInstance.LaunchedAvailabilityZone];
	prices[Math.ceil(new Date().getTime() / 1000)] = prices[Object.keys(prices).slice(-1)];

	var timestamps = Object.keys(prices).sort(function(a, b) { return a - b; });

	var accCost = 0;
	var accSeconds = 0;
	var tempStartTime = Math.floor(new Date(spotInstance.CreateTime).getTime() / 1000);
	timestamps.forEach(function(e) {
		// console.log("Checking against time: " + e)
		if (e <= tempStartTime) {
			return true;
		}

		var pps = prices[e] / 3600;
		var seconds = e - tempStartTime;

		accCost += (seconds * pps);
		accSeconds += seconds;

		// console.log("Costs: " + seconds + " seconds @ " + prices[e] + "/hr = " + (seconds * pps).toFixed(8));
		// console.log("Oldtime: " + tempStartTime + "; Newtime: " + (tempStartTime - seconds));

		tempStartTime += seconds;
	});

	console.log("Instance " + spotInstance.InstanceId + " up for " + accSeconds + " seconds; estimated cost $" + accCost.toFixed(4));

	var actualDuration = (new Date().getTime()) - (new Date(spotInstance.CreateTime).getTime())
	// console.log("^-- This should not exceed " + (actualDuration / 1000).toFixed(0));

	return accCost;
}

var knownSpotPrices = {};
var getSpotPriceHistory = function(region, instanceType) {
	var ec2 = new aws.EC2({region: region});

	return new Promise((success, failure) => {
		if (typeof knownSpotPrices[ec2.config.region + ":" + instanceType] != "undefined") {
			return success(knownSpotPrices[ec2.config.region + ":" + instanceType]);
		}

		ec2.describeSpotPriceHistory({
			InstanceTypes: [
				instanceType
			],
			ProductDescriptions: [
				"Linux/UNIX (Amazon VPC)"
			],
			// Default to retrieving the last two days' spot prices.
			StartTime: (new Date().getTime() / 1000) - (60 * 60 * 48)
		}, function(err, data) {
			if (err) {
				return failure(err);
			}

			knownSpotPrices[ec2.config.region + ":" + instanceType] = {};
			data.SpotPriceHistory.forEach(function(e) {
				e.require({
					"AvailabilityZone": 0,
					"SpotPrice": 0,
					"Timestamp": 0
				});

				if (typeof knownSpotPrices[ec2.config.region + ":" + instanceType][e.AvailabilityZone] == "undefined") {
					knownSpotPrices[ec2.config.region + ":" + instanceType][e.AvailabilityZone] = {};
				}

				knownSpotPrices[ec2.config.region + ":" + instanceType][e.AvailabilityZone][new Date(e.Timestamp).getTime() / 1000] = e.SpotPrice;
			});

			return success(knownSpotPrices[ec2.config.region + ":" + instanceType]);
		})
	});
}

var knownSpotFleetRequests = {};
var listSpotFleetRequests = function(region) {
	var ec2 = new aws.EC2({region: region});

	return new Promise((success, failure) => {
		ec2.describeSpotFleetRequests({}, function(err, data) {
			if (err) {
				return failure(cb("Failed retrieving spot fleet information."));
			}

			data.SpotFleetRequestConfigs.forEach(function(e) {
				knownSpotFleetRequests[e.SpotFleetRequestId] = e;
				knownSpotFleetRequests[e.SpotFleetRequestId].Region = region;
			});

			return success(data.SpotFleetRequestConfigs);
		});
	});
}

var getSpotFleetInstances = function(region, spotFleetRequestId) {
	var ec2 = new aws.EC2({region: region});

	return new Promise((success, failure) => {
		ec2.describeSpotFleetInstances({
			SpotFleetRequestId: spotFleetRequestId
		}, function(err, data) {
			if (err) {
				return failure(cb("Failed retrieving spot fleet information: " + err));
			}

			knownSpotFleetRequests[spotFleetRequestId].ActiveInstances = data.ActiveInstances;

			return success(data.ActiveInstances);
		});
	});
}

// This is better than describeSpotFleetInstances.ActiveInstances, but isn't perfect.
var getInstancesFromSpotFleetHistory = function(region, spotFleetRequestId) {
	var ec2 = new aws.EC2({region: region});

	return new Promise((success, failure) => {
		ec2.describeSpotFleetRequestHistory({
			SpotFleetRequestId: spotFleetRequestId,
			StartTime: "1970-01-01T00:00:00Z"
		}, function(err, data) {
			if (err) {
				return failure(cb("Failed retrieving spot fleet history: " + err));
			}

			var knownInstances = {};
			data.HistoryRecords.forEach(function(e) {
				if (e.EventType == "instanceChange") {
					knownInstances[e.EventInformation.InstanceId] = 1;
				}
			});

			knownSpotFleetRequests[spotFleetRequestId].AllInstanceIds = Object.keys(knownInstances);

			return success(Object.keys(knownInstances));
		});
	});
}

var knownSpotInstanceRequests = {};
var listSpotInstanceRequests = function(region) {
	var ec2 = new aws.EC2({region: region});

	return new Promise((success, failure) => {
		ec2.describeSpotInstanceRequests({}, function(err, data) {
			if (err) {
				return failure(cb("Failed retrieving spot request information."));
			}

			data.SpotInstanceRequests.forEach(function(e) {
				knownSpotInstanceRequests[e.InstanceId] = e;
				knownSpotInstanceRequests[e.InstanceId].Region = region;
			});

			return success(data.SpotInstanceRequests);
		});
	});
}

var terminateSpotFleet = function(region, spotFleetRequestId) {
	var ec2 = new aws.EC2({region: region});

	return new Promise((success, failure) => {
		ec2.cancelSpotFleetRequests({
			TerminateInstances: true,
			SpotFleetRequestIds: [
				spotFleetRequestId
			]
		}, function(err, data) {
			if (err) {
				return failure(cb(criticalAlert("Failure cancelling spot fleet: " + err)));
			}

			return success(data);
		});
	});
}

function editCampaignViaRequestId(spotFleetRequestId, values) {
	return new Promise((success, failure) => {
		db.query({
			ExpressionAttributeValues: {
				':s': {S: spotFleetRequestId}
			},
			KeyConditionExpression: 'spotFleetRequestId = :s',
			IndexName: "SpotFleetRequests",
			TableName: "Campaigns"
		}, function (err, data) {
			if (err) {
				return failure(cb("Error querying SpotFleetRequest table: " + err));
			}

			if (data.Items.length < 1) {
				return success(null)
			}

			var data = ddbTypes.unwrap(data.Items[0]);
			console.log("Found campaign " + data.keyid.split(':').slice(1));

			editCampaign(data.userid, data.keyid.split(':').slice(1), values).then((updates) => {
				success(updates);
			});
		});
	});
}

function editCampaign(entity, campaign, values) {
	return new Promise((success, failure) => {
		values = ddbTypes.wrap(values);

		Object.keys(values).forEach(function(e) {
			values[e] = {
				Action: "PUT",
				Value: values[e]
			}
		});

		var ddbParams = {
			Key: {
				userid: {S: entity},
				keyid: {S: "campaigns:" + campaign}
			},
			TableName: "Campaigns",
			AttributeUpdates: values
		};

		// console.log(JSON.stringify(ddbParams));

		db.updateItem(ddbParams, function (err, data) {
			if (err) {
				return failure(respond(500, "Error updating table: " + err, false));
			}

			return success(true);
		});
	});
}

var criticalAlert = function(message) {
	return new Promise((success, failure) => {
		var sns = new aws.SNS({apiVersion: '2010-03-31', region: 'us-west-2'});

		sns.publish({
			Message: "NPK CriticalAlert: " + message,
			Subject: "NPK CriticalAlert",
			TopicArn: settings.critical_events_sns_topic
		}, function (err, data) {
			if (err) {
				console.log('CRITICAL ALERT FAILURE: ' + err)
				return failure(err);
			}

			console.log('CRITICAL ALERT: ' + message);
			return success(data);
		});
	});
}

var evaluateAllSpotInstances = function() {

	var availabilityZones = {
		"us-east-1": [
			"us-east-1a",
			"us-east-1b",
			"us-east-1c",
			"us-east-1d",
			"us-east-1e",
			"us-east-1f",
		],
		"us-east-2": [
			"us-east-2a",
			"us-east-2b",
			"us-east-2c",
		],
		"us-west-1": [
			"us-west-1a",
			// TODO: is fubar. "us-west-1b",
			"us-west-1c",
		],
		"us-west-2": [
			"us-west-2a",
			"us-west-2b",
			"us-west-2c",
		],
	}

	var promises = [];
	Object.keys(availabilityZones).forEach(function(region) {
		promises.push(listSpotFleetRequests(region));
		promises.push(listSpotInstanceRequests(region));
	});

	var instancePromises = [];
	var cancellationPromises = [];
	Promise.all(promises).then((data) => {

		Object.keys(knownSpotFleetRequests).forEach(function (e) {
			if (knownSpotFleetRequests[e].SpotFleetRequestState.indexOf("cancelled") < 0) {
				instancePromises.push(getInstancesFromSpotFleetHistory(knownSpotFleetRequests[e].Region, e));
				instancePromises.push(getSpotFleetInstances(knownSpotFleetRequests[e].Region, e));
			} else {
				var status = (knownSpotFleetRequests[e].SpotFleetRequestState == "cancelled") ? "COMPLETED" : "CANCELLING";

				cancellationPromises.push(editCampaignViaRequestId(e, {
					active: false,
					status: status
				}).then((data) => {

					if (data) {
						console.log("Marked campaign with spotFleetRequestId " + e + " as " + status + ".");
					} else {
						console.log("Failed to mark campaign with spotFleetRequestId " + e + " as " + status + ".");
					}
				}));

				delete knownSpotFleetRequests[e];
			}
		});

		Object.keys(knownSpotInstanceRequests).forEach(function(s) {
			instancePromises.push(getSpotPriceHistory(knownSpotInstanceRequests[s].Region, knownSpotInstanceRequests[s].LaunchSpecification.InstanceType));
		});

		// Stop early if there are no fleets to process.
		if (instancePromises.length < 1) {
			return cb(null, "No active fleet requests");
		}

		Promise.all(instancePromises).then((data) => {
			var finalPromises = [];
			Object.keys(knownSpotFleetRequests).forEach(function(e) {
				var totalCosts = 0;
				var terminateFleet = false;
				knownSpotFleetRequests[e].Tags = {};
				knownSpotFleetRequests[e].SpotFleetRequestConfig.LaunchSpecifications[0].TagSpecifications.forEach(function(l) {
					l.Tags.forEach(function(t) {
						knownSpotFleetRequests[e].Tags[t.Key] = t.Value
					});
				});

				//knownSpotFleetRequests[e].ActiveInstances.forEach(function(i) {
				knownSpotFleetRequests[e].AllInstanceIds.forEach(function(i) {
					//var instanceCost = calculateSpotCosts(knownSpotFleetRequests[e].Region, knownSpotInstanceRequests[i.InstanceId]);
					var instanceCost = calculateSpotCosts(knownSpotFleetRequests[e].Region, knownSpotInstanceRequests[i]);
					totalCosts += instanceCost;

					console.log(" --> current costs: $" + instanceCost.toFixed(4) + "; max cost: $" + parseFloat(knownSpotFleetRequests[e].Tags.MaxCost).toFixed(4));
					if (instanceCost > (parseFloat(knownSpotFleetRequests[e].Tags.MaxCost) * 1.1)) {
						criticalAlert('Campaign costs exceeds configured limit. Terminating spot fleet request ' + e);
						terminateFleet = true;
					}

					if (instanceCost > parseFloat(knownSpotFleetRequests[e].Tags.MaxCost)) {
						terminateFleet = true;
					}
				});

				knownSpotFleetRequests[e].TotalCosts = totalCosts;

				console.log("Debug: Writing live status for campaign " + e);
				var writeParams = {
					active: true,
					price: totalCosts,
					status: "RUNNING"
				};

				if (totalCosts == 0) {
					delete writeParams.totalCosts;
				}
				
				finalPromises.push(editCampaignViaRequestId(e, writeParams));

				if (totalCosts > settings.campaign_max_price) {
					criticalAlert('Campaign costs exceeds configured limit. Terminating spot fleet request ' + e);
					terminateFleet = true;
				}

				if (terminateFleet) {
					finalPromises.push(terminateSpotFleet(knownSpotFleetRequests[e].Region, e).then((data) => {
						var errors = 0;
						if (data.SuccessfulFleetRequests.length > 0) {
							data.SuccessfulFleetRequests.forEach(function(r) {
								if (r.CurrentSpotFleetRequestState != "cancelled_terminating") {
									finalPromises.push(criticalAlert('Cancelled spot fleet ' + r.SpotFleetRequestId + ' is not terminating. Intervene immediately!'));
								} else {
									console.log('Spot fleet ' + r.SpotFleetRequestId + ' cancelled successfully.');
								}
							});
						}

						if (data.UnsuccessfulFleetRequests.length > 0) {
							data.UnsuccessfulFleetRequests.forEach(function(r) {
								finalPromises.push(criticalAlert('Error cancelling spot fleet ' + r.SpotFleetRequestId + ': ' + r.Error.Message + '; Intervene immediately!'));
							});
						}

						return Promise.resolve(true);
					}));
				}
			});

			return Promise.all(finalPromises).then((data) => {
				cb(null, "Spot Monitor invocation completed.");
			});
		});
	});
}

exports.main = function(event, context, callback) {

	cb = function(err, data) {
		if (err) {
			throw new Error (callback(err));
			process.exit();
		}

		console.log("Exiting: " + data);

		callback(null, data);
		// process.exit();
	};

	try {
		evaluateAllSpotInstances();
	} catch (err) {
		return cb("evaluateAllSpotInstances failed: " + err);
	}
};