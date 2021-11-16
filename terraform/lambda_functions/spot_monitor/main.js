"use strict";

const fs = require('fs');
const aws 	= require('aws-sdk');
const settings = JSON.parse(JSON.stringify(process.env));
settings.regions = JSON.parse(settings.regions);

const accountDetails = JSON.parse(fs.readFileSync('./accountDetails.json', 'ascii'));

aws.config.apiVersions = {
	dynamodb: 	'2012-08-10'
};

aws.config.update({region: settings.region});

const db = new aws.DynamoDB();

exports.main = async function(event, context, callback) {

	let spotFleets = {};
	let promises = [];

	// Enumerate spot fleet requests and histories across all regions.
	try {

		for (const region of Object.keys(settings.regions)) {
			const ec2 = new aws.EC2({region: region});

			promises.push(ec2.describeSpotFleetRequests({}).promise().then(async (data) => {

				for (let config of data.SpotFleetRequestConfigs) {
					// Skip fleets more than a day old, since some history items can expire before the fleet does.
					if (new Date(config.CreateTime).getTime() < new Date().getTime() - (1000 * 60 * 60 * 24)) {
						console.log(`[-] ${config.SpotFleetRequestId} created more than a day ago. Skipping.`);
						continue;
					}

					const history = await getSpotRequestHistory(ec2, config.SpotFleetRequestId);

					spotFleets[config.SpotFleetRequestId] = {
						...config,
						region,
						history,
						instances: {},
						price: 0
					};
				};
			}));
		};

		await Promise.all(promises);

		if (!Object.keys(spotFleets).length) {
			return callback(null, "[*] No spot fleets to process.");
		} else {
			console.log(`[+] Found ${Object.keys(spotFleets).length} SFRs to process.`);
		}

	} catch (e) {
		console.log(e);
		return callback(`[!] Failed to retreive spot fleets and history: ${e}`);
	}

	promises = [];

	// Enumerate spot instances from all regions, and associate them with their SFRs.
	try {
		Object.keys(settings.regions).forEach(function(region) {
			const ec2 = new aws.EC2({region: region});

			promises.push(ec2.describeSpotInstanceRequests({}).promise().then((data) => {
				data.SpotInstanceRequests.forEach(function(request) {
					request.Tags = request.Tags.reduce((tags, tag) => {
						tags[tag.Key] = tag.Value;

						return tags;
					}, {});

					if (!request.Tags['aws:ec2spot:fleet-request-id']) {
						console.log(`[-] Instance ${request.InstanceId} has no SFR ID.`);
						console.log(request.Tags);
						return false
					}

					const sfr = request.Tags['aws:ec2spot:fleet-request-id'];

					spotFleets[sfr].instances[request.InstanceId] = {
						Status: {
							Code: request.Status.Code,
							Message: request.Status.Message
						},
						State: request.State
					}
				});

				return true;
			}));
		});

		await Promise.all(promises);

	} catch (e) {
		console.log(e);
		return callback(`[!] Failed to retreive spot instance statuses: ${e}`);
	}

	promises = [];

	try {
		Object.keys(spotFleets).forEach((fleetId) => {
			const fleet = spotFleets[fleetId];

			const instanceCount = Object.keys(fleet.instances).length;

			if (!instanceCount) {
				console.log(`[-] Found 0 instances for ${fleetId}`);
			} else {
				console.log(`[+] Found ${instanceCount} instances for ${fleetId}`);
			}

			const hasOpenInstances = Object.keys(fleet.instances).reduce((state, instanceId) => {
				const instance = fleet.instances[instanceId];

				if (['open', 'active'].indexOf(instance.State) > -1 ) {
					return true;
				}

				return state;
			}, false);

			if (!hasOpenInstances) {
				console.log(`[+] Fleet ${fleetId} with status ${fleet.SpotFleetRequestState} has open instances: ${hasOpenInstances}.`);
			}

			if (!!instanceCount && !hasOpenInstances && !/cancelled/.test(fleet.SpotFleetRequestState)) {
				const ec2 = new aws.EC2({region: fleet.region});

				promises.push(ec2.cancelSpotFleetRequests({
					TerminateInstances: true,
					SpotFleetRequestIds: [fleetId]
				}).promise().then((data) => {
					console.log(`[+] Cancelled ${fleetId} due to all instance requests being closed.`);
				}, (e) => {
					console.log(`[-] Unable to cancel ${fleetId} due to all instance requests being closed.`, e);
				}));
			}
		});
	} catch (e) {
		console.log(e);
		return callback(`[!] Failed to handle exhausted campaigns: ${e}`);
	}

	promises = [];
	const spotPrices = {};

	// Get spot instance events, along with price history for each instance type found.
	try {

		// Iterate over the identified SFRs and remove any that are cancelled and empty.
		spotFleets = Object.keys(spotFleets).reduce((fleets, fleetId) => {
			const fleet = spotFleets[fleetId];

			if (!!fleet.instances.length && /cancelled/.test(fleet.SpotFleetRequestState)) {
				console.log(`[-] Cancelled fleet [${fleet.SpotFleetRequestId}] has no instance statuses.`);
				return fleets;
			}

			if (/cancelled/.test(fleet.SpotFleetRequestState)) {
				const fleetState = (fleet.SpotFleetRequestState == "cancelled") ? "COMPLETED" : "STOPPING";

				promises.push(editCampaignViaRequestId(fleet.SpotFleetRequestId, {
					active: false,
					spotRequestHistory: fleet.history,
					spotRequestStatus: fleet.instances,
					status: fleetState
				}).then((data) => {
					console.log(`[+] Marked campaign of ${fleet.SpotFleetRequestId} as ${fleetState}`);
				}, (e) => {
					console.log(`[!] Failed attempting to update ${promiseDetails.fleets[fleetId].SpotFleetRequestId}`);
				}));

				if (fleet.SpotFleetRequestState == "cancelled") {
					return fleets;
				}
			}

			if (!!fleet.instances.length) {
				console.log(`[!] Fleet [${fleet.SpotFleetRequestId}] with status [${fleet.SpotFleetRequestState}] has no instance statuses.`);
			}

			// Loop over 'instanceChange' events to record the start and stop time of given instances.
			fleet.history.forEach((historyRecord) => {
				if (historyRecord.EventType != "instanceChange") {
					return false;
				}

				const event = JSON.parse(historyRecord.EventInformation.EventDescription);

				if (!historyRecord?.EventInformation?.InstanceId) {
					return false;
				}

				const instanceId = historyRecord.EventInformation.InstanceId;

				if (!fleet.instances[instanceId]) {
					// This can happen when nodes are new. Be lenient.
					return false;
				}

				// Create the basic record, to be populated based on event status.
				if (!fleet.instances[instanceId].history) {

					fleet.instances[instanceId].instanceType = event.instanceType;
					fleet.instances[instanceId].image = event.image;
					fleet.instances[instanceId].availabilityZone = event.availabilityZone;
					fleet.instances[instanceId].ProductDescriptions = event.ProductDescriptions;

					fleet.instances[instanceId].history = {
						startTime: 0,
						endTime: new Date().getTime() / 1000
					}
				}

				// Set record details based on event type.
				switch (historyRecord.EventInformation.EventSubType) {
					case "launched":
						fleet.instances[instanceId].history.startTime = new Date(historyRecord.Timestamp).getTime();
					break;

					case "terminated":
						fleet.instances[instanceId].history.endTime = new Date(historyRecord.Timestamp).getTime();
					break;
				}

				// Retrieve spot price history based on region and instance type.
				const spotKey = fleet.region + ":" + event.instanceType;

				// Skip remaining processing if it's already been requested.
				if (!!spotPrices[spotKey]) {
					return false;
				}

				spotPrices[spotKey] = {};

				const ec2 = new aws.EC2({region: fleet.region});
				promises.push(ec2.describeSpotPriceHistory({
					InstanceTypes: [event.instanceType],
					ProductDescriptions: ["Linux/UNIX (Amazon VPC)"],

					// Default to retrieving the last two days' spot prices.
					StartTime: (new Date().getTime() / 1000) - (60 * 60 * 48)
				}).promise().then((data) => {

					data.SpotPriceHistory.forEach(function(spotHistoryItem) {
						const az = spotHistoryItem.AvailabilityZone;
						const dateKey = new Date(spotHistoryItem.Timestamp).getTime();

						if (!spotPrices[spotKey][az]) {
							spotPrices[spotKey][az] = {};
						}

						spotPrices[spotKey][az][dateKey] = spotHistoryItem.SpotPrice;
					});
				}));
			});

			fleets[fleetId] = fleet;
			return fleets;
		}, {});

		await Promise.all(promises);

	} catch (e) {
		console.log(e);
		return callback(`[!] Failed to get instance history and prices: ${e}`);
	}

	promises = [];

	// Promises are all done. Let's calculate the instance costs, and roll them up to the fleet.
	try {

		Object.keys(spotFleets).forEach((fleetId) => {
			const fleet = spotFleets[fleetId];

			Object.keys(fleet.instances).forEach((instanceId) => {
				const instance = fleet.instances[instanceId];

				const prices = spotPrices[fleet.region + ':' + instance.instanceType][instance.availabilityZone];
				prices[new Date().getTime()] = prices[Object.keys(prices).slice(-1)];

				const timestamps = Object.keys(prices).sort(function(a, b) { return a - b; });

				let accCost = 0;
				let accSeconds = 0;

				let duration = instance.history.endTime - instance.history.startTime;

				// This isn't a thing anymore. Fun times.
				//duration = (duration < 3600) ? 3600 : duration;

				let tempStartTime = instance.history.startTime;

				// console.log("duration: " + duration);
				timestamps.forEach(function(e) {
					// console.log("Checking against time: " + e)
					if (e <= tempStartTime || accSeconds >= duration) {
						return true;
					}

					var ppms = prices[e] / 3600;
					var mseconds = e - tempStartTime;

					if (accSeconds + mseconds > duration) {
						mseconds -= (accSeconds + mseconds - duration);
					}

					accCost += (mseconds * ppms);
					accSeconds += mseconds;

					tempStartTime += mseconds;
				});

				console.log(`[*] Instance ${instanceId} up for ${accSeconds} seconds; estimated cost $${accCost.toFixed(4)}`);
				instance.price = accCost;
				fleet.price += accCost;
			});

			const tags = {};
			fleet.SpotFleetRequestConfig.LaunchSpecifications[0].TagSpecifications.forEach((tagspec) => {
				tagspec.Tags.forEach(function(tag) {
					tags[tag.Key] = tag.Value;
				});
			});

			const fleetState = (/cancelled/.test(fleet.SpotFleetRequestState)) ? "STOPPING" : "RUNNING";

			promises.push(editCampaignViaRequestId(fleetId, {
				active: true,
				price: fleet.price,
				spotRequestHistory: fleet.history,
				spotRequestStatus: fleet.instances,
				status: fleetState
			}).then((data) => {
				console.log(`[+] Updated price of fleet ${fleetId}`);
			}, (e) => {
				console.log(`[!] Failed attempting to update price for ${fleetId}`);
			}));

			if (fleet.price > parseFloat(tags.MaxCost) || fleet.price > parseFloat(settings.campaign_max_price)) {
				console.log("Fleet " + fleetId + " costs exceed limits; terminating.");

				finalPromises.push(ec2.cancelSpotFleetRequests({
					TerminateInstances: true,
					SpotFleetRequestIds: [fleetId]
				}).promise().then((data) => {
					console.log(`Successfully terminated ${fleetId}`);
					return Promise.resolve();
				}, (e) => {
					console.log(e);
					return criticalAlert(`Failed to terminate fleet ${fleetId} with cost $${fleet.price}`);
				}));
			}

			if (fleet.price > parseFloat(tags.MaxCost) * 1.1 || fleet.price > parseFloat(settings.campaign_max_price) * 1.1) {
				console.log("Fleet " + fleetId + " costs CRITICALLY exceed limits (" + fleet.price + "); terminating and raising critical alert.");
				finalPromises.push(critcalAlert("SFR " + fleetId + " current price is: " + fleet.price + "; Terminating."));

				finalPromises.push(ec2.cancelSpotFleetRequests({
					TerminateInstances: true,
					SpotFleetRequestIds: [fleetId]
				}).promise().then((data) => {
					console.log(`Successfully terminated ${fleetId}`);
					return Promise.resolve();
				}, (e) => {
					return criticalAlert(`Failed to terminate fleet ${fleetId} with cost $${fleet.price}`);
				}));
			}
		});

		await Promise.all(promises);

	} catch (e) {
		console.log(e);
		return callback(`[!] Failed to update spot instance costs: ${e}`);
	}

	return callback(null, `[+] Reviewed [${Object.keys(spotFleets).length}] SFRs.`);
};

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
			console.log("[+] Found campaign " + data.keyid.split(':').slice(1));

			editCampaign(data.userid, data.keyid.split(':').slice(1), values).then((updates) => {
				success(updates);
			});
		});
	});
}

function getSpotRequestHistory(ec2, sfr, nextToken = null) {
	let history = [];

	return ec2.describeSpotFleetRequestHistory({
		SpotFleetRequestId: sfr,
		StartTime: "1970-01-01T00:00:00Z",
		NextToken: nextToken
	}).promise().then((data) => {
		
		history = history.concat(data.HistoryRecords);

		if (data.hasOwnProperty('NextToken')) {
			return getSpotRequestHistory(ec2, sfr, data.NextToken);
		}

		history = history.map((entry) => {
			entry.Timestamp = new Date(entry.Timestamp).getTime() / 1000;

			return entry
		});

		return history;
	});
}