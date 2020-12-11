/*jshint esversion: 6 */
/*jshint node: true */

"use strict";

var cb = "";
// var AWSXRay 	= require('aws-xray-sdk');
// var aws			= AWSXRay.captureAWS(require('aws-sdk'));
var aws 	= require('aws-sdk');
var settings = JSON.parse(JSON.stringify(process.env));
settings.availabilityZones = JSON.parse(settings.availabilityZones);

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
};

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

	var actualDuration = (new Date().getTime()) - (new Date(spotInstance.CreateTime).getTime());
	// console.log("^-- This should not exceed " + (actualDuration / 1000).toFixed(0));

	return accCost;
};

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
		});
	});
};

var knownSpotFleetRequests = {};
var listSpotFleetRequests = function(region) {
	var ec2 = new aws.EC2({region: region});

	return new Promise((success, failure) => {
		ec2.describeSpotFleetRequests({}, function(err, data) {
			if (err) {
				return failure(cb("Failed retrieving spot fleet information." + err));
			}

			data.SpotFleetRequestConfigs.forEach(function(e) {
				knownSpotFleetRequests[e.SpotFleetRequestId] = e;
				knownSpotFleetRequests[e.SpotFleetRequestId].Region = region;
			});

			return success(data.SpotFleetRequestConfigs);
		});
	});
};

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
};

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
};

var spotRequestsByFleetRequest = {};
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

				var tags = {};
				e.Tags.forEach(function(t) {
					tags[t.Key] = t.Value;
				})

				spotRequestsByFleetRequest[tags["aws:ec2spot:fleet-request-id"]] = e.Status;
			});

			return success(data.SpotInstanceRequests);
		});
	});
};

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
};

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
				return success(null);
			}

			data = aws.DynamoDB.Converter.unmarshall(data.Items[0]);
			console.log("Found campaign " + data.keyid.split(':').slice(1));

			editCampaign(data.userid, data.keyid.split(':').slice(1), values).then((updates) => {
				success(updates);
			});
		});
	});
}

function editCampaign(entity, campaign, values) {
	return new Promise((success, failure) => {
		values = aws.DynamoDB.Converter.marshall(values);

		Object.keys(values).forEach(function(e) {
			values[e] = {
				Action: "PUT",
				Value: values[e]
			};
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
				return failure(err);
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
				console.log('CRITICAL ALERT FAILURE: ' + err);
				return failure(err);
			}

			console.log('CRITICAL ALERT: ' + message);
			return success(data);
		});
	});
};

var evaluateAllSpotInstances = function() {

	var availabilityZones = settings.availabilityZones;

	var promises = [];
	Object.keys(availabilityZones).forEach(function(region) {
		// console.log(region);
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

				var spotStatus = { Code: "", Message: ""};
				if (typeof spotRequestsByFleetRequest[e] != "undefined") {
					spotStatus = spotRequestsByFleetRequest[e];
					delete spotStatus.UpdateTime;
				}
				
				cancellationPromises.push(editCampaignViaRequestId(e, {
					active: false,
					spotRequestStatus: spotStatus,
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
						knownSpotFleetRequests[e].Tags[t.Key] = t.Value;
					});
				});

				knownSpotFleetRequests[e].AllInstanceIds.forEach(function(i) {
					//var instanceCost = calculateSpotCosts(knownSpotFleetRequests[e].Region, knownSpotInstanceRequests[i.InstanceId]);
					// console.log(knownSpotInstanceRequests[i]);
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

				var spotStatus = spotRequestsByFleetRequest[e];
				delete spotStatus.UpdateTime;

				console.log("Debug: Writing live status for campaign " + e);
				var writeParams = {
					active: true,
					price: totalCosts,
					spotRequestStatus: spotStatus,
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
};

exports.main = function(event, context, callback) {

	var promiseDetails = { fleets: {}, spotPrices: {}, instances: {} };
	var promiseError = false;

	var spotFleetPromises = [];
	Object.keys(settings.availabilityZones).forEach(function(region) {
		var ec2 = new aws.EC2({region: region});

		spotFleetPromises.push(ec2.describeSpotFleetRequests({}).promise().then((data) => {
			return { fleets: data.SpotFleetRequestConfigs, region: region };
		}));
	});

	// Get all the spot fleets
	return Promise.all(spotFleetPromises).then((fleetObjects) => {

		var fleetPromises = [];		
		fleetObjects.forEach(function(fleetObject) {

			var fleets = fleetObject.fleets;
			var region = fleetObject.region;

			fleets.forEach(function(fleet) {

				// Skip fleets more than a day old, since some history items can expire before the fleet does.
				if (new Date(fleet.CreateTime).getTime() < new Date().getTime() - (1000 * 60 * 60 * 24)) {
					console.log(fleet.SpotFleetRequestId + " created more than a day ago. Skipping.");
					return false;
				}

				if (fleet.SpotFleetRequestState.indexOf("cancelled") == 0) {
					fleetPromises.push(editCampaignViaRequestId(fleet.SpotFleetRequestId, {
						active: false,
						price: fleet.price,
						spotRequestStatus: fleet.SpotFleetRequestState,
						status: (fleet.SpotFleetRequestState == "cancelled") ? "COMPLETED" : "CANCELLING"
					}).then((data) => {
						console.log("Marked campaign of " + fleet.SpotFleetRequestId + " as " + ((fleet.SpotFleetRequestState == "cancelled") ? "COMPLETED" : "CANCELLING"))
					}, (e) => {
						console.log("[!] Failed attempting to update " + fleet.SpotFleetRequestId);
					}));

					return false;
				}

				var ec2 = new aws.EC2({region: region});

				promiseDetails.fleets[fleet.SpotFleetRequestId] = fleet;
				promiseDetails.fleets[fleet.SpotFleetRequestId].region = region;
				promiseDetails.fleets[fleet.SpotFleetRequestId].instances = {};
				promiseDetails.fleets[fleet.SpotFleetRequestId].price = 0;

				// Get the instances for each fleet
				/*fleetPromises.push(ec2.describeSpotFleetInstances({
					SpotFleetRequestId: fleet.SpotFleetRequestId
				}).promise().then((data) => {
					// Save the active instances
					promiseDetails.fleet[fleet.SpotFleetRequestId].instances = data.ActiveInstances;
				}));*/

				fleetPromises.push(ec2.describeSpotFleetRequestHistory({
					SpotFleetRequestId: fleet.SpotFleetRequestId,
					StartTime: "1970-01-01T00:00:00Z"
				}).promise().then((data) => {
					promiseDetails.fleets[fleet.SpotFleetRequestId].history = data.HistoryRecords;
				}));
			});

		});

		return Promise.all(fleetPromises);

	}, (e) => {
		console.log("spotFleetPromises failed.", e);

		promiseError = e;
		return Promise.resolve(e)
	}).then((fleetPromises) => {
		if (promiseError) {
			return Promise.resolve("Skipping due to prior error.");
		};

		var spotPricePromises = [];

		// Loop over the state changes to find spot price histories we need.
		Object.keys(promiseDetails.fleets).forEach(function(fleetId) {
			promiseDetails.fleets[fleetId].history.forEach(function(historyRecord) {
				// Skip anything that isn't an instanceChange request.
				if (historyRecord.EventType != "instanceChange") {
					return false;
				}

				// Save the instance information for later:
				var event = JSON.parse(historyRecord.EventInformation.EventDescription);
				if (!promiseDetails.instances.hasOwnProperty(historyRecord.EventInformation.InstanceId)) {
					promiseDetails.instances[historyRecord.EventInformation.InstanceId] = event;
					promiseDetails.instances[historyRecord.EventInformation.InstanceId].fleetId = fleetId;
					promiseDetails.instances[historyRecord.EventInformation.InstanceId].region = promiseDetails.fleets[fleetId].region;
					promiseDetails.instances[historyRecord.EventInformation.InstanceId].startTime = 0;
					promiseDetails.instances[historyRecord.EventInformation.InstanceId].endTime = new Date().getTime();
				}
				
				switch (historyRecord.EventInformation.EventSubType) {
					case "launched":
						promiseDetails.instances[historyRecord.EventInformation.InstanceId].startTime = new Date(historyRecord.Timestamp).getTime();
					break;

					case "terminated":
						promiseDetails.instances[historyRecord.EventInformation.InstanceId].endTime = new Date(historyRecord.Timestamp).getTime();
					break;
				}

				// Create a key based on region and instanceType, to track previously-requested combinations.
				var spotKey = promiseDetails.fleets[fleetId].region + ":" + event.instanceType;

				// Skip remaining processing if it's already been requested.
				if (promiseDetails.spotPrices.hasOwnProperty(spotKey)) {
					return false;
				}

				promiseDetails.spotPrices[spotKey] = {};
				var ec2 = new aws.EC2({region: promiseDetails.fleets[fleetId].region});
				spotPricePromises.push(ec2.describeSpotPriceHistory({
					InstanceTypes: [event.instanceType],
					ProductDescriptions: ["Linux/UNIX (Amazon VPC)"],
					// Default to retrieving the last two days' spot prices.
					StartTime: (new Date().getTime() / 1000) - (60 * 60 * 48)
				}).promise().then((data) => {

					data.SpotPriceHistory.forEach(function(spotHistoryItem) {
						if (!promiseDetails.spotPrices[spotKey].hasOwnProperty(spotHistoryItem.AvailabilityZone)) {
							promiseDetails.spotPrices[spotKey][spotHistoryItem.AvailabilityZone] = {};
						}

						var dateKey = new Date(spotHistoryItem.Timestamp).getTime();
						promiseDetails.spotPrices[spotKey][spotHistoryItem.AvailabilityZone][dateKey] = spotHistoryItem.SpotPrice;
					});
				}));
			});
		});

		return Promise.all(spotPricePromises);

	}, (e) => {
		console.log("fleetPromises failed.", e);

		promiseError = e;
		return Promise.resolve(e);
	}).then((spotPricePromises) => {
		if (promiseError) {
			return Promise.resolve("Skipping due to prior error.");
		};

		// Promises are all done. Let's calculate the instance costs, and roll them up to the fleet.
		Object.keys(promiseDetails.instances).forEach(function(instanceId) {
			var instance = promiseDetails.instances[instanceId];

			var prices = promiseDetails.spotPrices[instance.region + ':' + instance.instanceType][instance.availabilityZone];
			prices[new Date().getTime()] = prices[Object.keys(prices).slice(-1)];

			var timestamps = Object.keys(prices).sort(function(a, b) { return a - b; });

			var accCost = 0;
			var accSeconds = 0;
			var duration = instance.endTime - instance.startTime;
			var tempStartTime = instance.startTime;

			// console.log("duration: " + duration);
			timestamps.forEach(function(e) {
				// console.log("Checking against time: " + e)
				if (e <= tempStartTime || accSeconds >= duration) {
					return true;
				}

				var ppms = prices[e] / 3600000;
				var mseconds = e - tempStartTime;

				if (accSeconds + mseconds > duration) {
					mseconds -= (accSeconds + mseconds - duration);
				}

				accCost += (mseconds * ppms);
				accSeconds += mseconds;

				// console.log("Costs: " + seconds + " seconds @ " + prices[e] + "/hr = " + (seconds * pps).toFixed(8));
				// console.log("Oldtime: " + tempStartTime + "; Newtime: " + (tempStartTime - seconds));

				tempStartTime += mseconds;
			});

			console.log("Instance " + instanceId + " up for " + (accSeconds / 1000).toFixed(3) + " seconds; estimated cost $" + accCost.toFixed(4));
			promiseDetails.instances[instanceId].price = accCost;
			promiseDetails.fleets[instance.fleetId].price += accCost;

			// var actualDuration = (new Date().getTime()) - (new Date(spotInstance.CreateTime).getTime());
			// console.log("^-- This should not exceed " + (actualDuration / 1000).toFixed(0));
		});

		var finalPromises = [];
		// Now review the fleets for those over their price limit.
		Object.keys(promiseDetails.fleets).forEach(function(fleetId) {
			var fleet = promiseDetails.fleets[fleetId];
			var tags = {};

			fleet.SpotFleetRequestConfig.LaunchSpecifications[0].TagSpecifications.forEach(function(l) {
				l.Tags.forEach(function(t) {
					tags[t.Key] = t.Value;
				});
			});

			// Update the current price.
			finalPromises.push(editCampaignViaRequestId(fleetId, {
				active: true,
				price: fleet.price,
				spotRequestStatus: fleet.SpotFleetRequestState,
				status: "RUNNING"
			}).then((data) => {
				console.log("Updated price of " + fleetId);
			}, (e) => {
				console.log("[!] Failed attempting to update price for " + fleetId);
			}));

			if (fleet.price > parseFloat(tags.MaxCost) || fleet.price > parseFloat(settings.campaign_max_price)) {
				console.log("Fleet " + fleetId + " costs exceed limits; terminating.");

				finalPromises.push(ec2.cancelSpotFleetRequests({
					TerminateInstances: true,
					SpotFleetRequestIds: [fleetId]
				}).promise().then((data) => {
					console.log("Cancelled " + fleetId);
					return Promise.resolve();
				}, (e) => {
					console.log(e);
					return criticalAlert('Failed to terminate fleet ' + fleetId);
				}));
			}

			if (fleet.price > parseFloat(tags.MaxCost) * 1.1 || fleet.price > parseFloat(settings.campaign_max_price) * 1.1) {
				console.log("Fleet " + fleetId + " costs CRITICALLY exceed limits (" + fleet.price + "); terminating and raising critical alert.");
				finalPromises.push(critcalAlert("SFR " + fleetId + " current price is: " + fleet.price + "; Terminating."));

				finalPromises.push(ec2.cancelSpotFleetRequests({
					TerminateInstances: true,
					SpotFleetRequestIds: [fleetId]
				}).promise().then((data) => {
					console.log("Cancelled " + fleetId);
					return Promise.resolve();
				}, (e) => {
					return criticalAlert('Failed to terminate fleet ' + fleetId);
				}));
			}
		});

		return Promise.all(finalPromises);

	}, (e) => {
		console.log("spotPricePromises failed.", e);

		promiseError = e;
		return Promise.resolve(e)
	}).then((spotPricePromises) => {
		if (promiseError) {
			return Promise.resolve("Skipping due to prior error.");
			callback(promiseError);
		};

		console.log("Finished.");
		callback(null, "Finished");

	}, (e) => {
		console.log("finalPromises failed.", e);
		callback(e);

		promiseError = e;
		return Promise.resolve(e)
	});
};

exports.main2 = function(event, context, callback) {

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