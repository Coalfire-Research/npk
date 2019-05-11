/*jshint esversion: 6 */
/*jshint node: true */

"use strict";

var fs 			= require('fs');
var aws			= require('aws-sdk');
var uuid		= require('uuid/v4');
var ddbTypes 	= require('dynamodb-data-types').AttributeValue;
var variables	= require('./api_handler_variables');
var cb = "";
var origin = "";

aws.config.apiVersions = {
	dynamodb: 	'2012-08-10',
	sqs: 		'2012-11-05',
	sns: 		'2010-03-31'
};

aws.config.update({region: 'us-west-2'});

var db = new aws.DynamoDB();
var sns = new aws.SNS();
var sqs = new aws.SQS();

var s3 = new aws.S3({region: variables.default_region});
var s3dict;

var allowed_regions = [
	"us-west-1",
	"us-west-2",
	"us-east-1",
	"us-east-2",
];

var allowed_intances = [
	"g3s.xlarge",
	"g3.4xlarge",
	"g3.8xlarge",
	"g3.16xlarge",

	"p2.xlarge",
	"p2.8xlarge",
	"p2.16xlarge",

	"p3.2xlarge",
	"p3.8xlarge",
	"p3.16xlarge"
];

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

function getCampaignManifest(entity, campaign) {
	return new Promise((success, failure) => {
		s3.getObject({
			Bucket: variables.userdata_bucket,
			Key: entity + '/campaigns/' + campaign + '/manifest.json'
		}, function(err, data) {
			if (err) {
				return failure(respond(400, "Failed to obtain campaign manifest: " + err, false));
			}

			var manifest = "";

			try {
				manifest = JSON.parse(data.Body.toString('ascii'));
			} catch (e) {
				return failure(respond(500, "Unable to read manifest contents: " + e, false));
			}

			return success(manifest);
		});
	});
}

function invalidMethod(path, method) {
	return respond(418, "No. I'm a teapot.", false);
}

function getActiveCampaigns(entity) {
	return new Promise((success, failure) => {
		db.query({
			ExpressionAttributeValues: {
				':id': {S: entity},
				':keyid': {S: "campaigns:"}
			},
			KeyConditionExpression: 'userid = :id and begins_with(keyid, :keyid)',
			TableName: "Campaigns"
		}, function (err, data) {
			if (err) {
				return failure(respond(500, "Unable to retrieve active campaigns.", false));
			}

			return success(data);
		});
	});
}

function getCampaign(entity, campaign) {
	return new Promise((success, failure) => {
		db.query({
			ExpressionAttributeValues: {
				':id': {S: entity},
				':keyid': {S: "campaigns:" + campaign}
			},
			KeyConditionExpression: 'userid = :id and keyid = :keyid',
			TableName: "Campaigns"
		}, function (err, data) {
			if (err) {
				return failure(respond(500, "Unable to retrieve active campaigns.", false));
			}

			return success(data);
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
				return failure(respond(500, "Error updating table: " + err, false));
			}

			return success(data);
		});
	});
}

function deleteCampaign(entity, campaign) {
	return new Promise((success, failure) => {
		// Delete all status reports and events;
		db.query({
			ExpressionAttributeValues: {
				':id': {S: entity},
				':keyid': {S: campaign + ":"}
			},
			KeyConditionExpression: 'userid = :id and begins_with(keyid, :keyid)',
			TableName: "Campaigns"
		}, function (err, data) {
			if (err) {
				return failure(respond(500, "Unable to retrieve active campaigns.", false));
			}

			var promises = [];

			data.Items.forEach(function(c) {
				var campaign = ddbTypes.unwrap(c);

				console.log(campaign);

				promises.push(
					new Promise((success, failure) => {
						db.deleteItem({
						Key: {
							userid: {S: entity},
							keyid: {S: campaign.keyid}
						},
						TableName: "Campaigns"
					}, function(err, data) {
						if (err) {
							console.log(err);
							return failure(err);
						}

						return success(true);
					});
				}));
			});

			// Delete the campaign itself;
			promises.push(
				new Promise((success, failure) => {
					db.deleteItem({
					Key: {
						userid: {S: entity},
						keyid: {S: "campaigns:" + campaign}
					},
					TableName: "Campaigns"
				}, function(err, data) {
					if (err) {
						console.log(err);
						return failure(err);
					}

					return success(true);
				});
			}));

			Promise.all(promises).then((data) => {
				return respond(200, "Deleted", true);
			}).catch((err) => {
				return respond(500, "Error while deleting campaign", false);
			});
		});
	});
}

function getObjectAverage(what) {
	var sum = 0;
	var count = 0;

	Object.keys(what).forEach(function(e) {
		sum += Number(what[e]);
		count++;
	});

	console.log(sum, count);

	return sum / count;
}

var knownInstanceAZs = {};
function getInstanceAZs(region, instanceType) {

	return new Promise((success, failure) => {

		if (typeof knownInstanceAZs[instanceType] == "undefined") {
			knownInstanceAZs[instanceType] = {};
		}

		if (typeof knownInstanceAZs[instanceType][region] != "undefined") {
			return success(knownInstanceAZs[instanceType][region]);
		}

		var ec2 = new aws.EC2({region: region});
		ec2.describeSpotPriceHistory({
			EndTime: Math.round(Date.now() / 1000),
			ProductDescriptions: [
				"Linux/UNIX (Amazon VPC)"
			],
			InstanceTypes: [
				instanceType
			],
			StartTime: Math.round(Date.now() / 1000)
		}, function (err, data) {
			if (err) {
				return failure(respond(500, "Error obtaining spot price: " + err, false));
			}

			var zones = [];
			data.SpotPriceHistory.forEach(function(e) {
				zones[e.AvailabilityZone] = e.SpotPrice;
			});

			knownInstanceAZs[instanceType][region] = zones;

			return success(zones);
		});
	});
}

function getNVidiaImage(region) {
	console.log("Debug: Retrieving NVidia images.");

	return new Promise((success, failure) => {
		var ec2 = new aws.EC2({region: region});
		ec2.describeImages({
			Filters: [{
                Name: "virtualization-type",
                Values: ["hvm"]
            },{
            	Name: "name",
            	Values: ["amzn-ami-graphics-hvm-20*"]
            },{
            	Name: "root-device-type",
            	Values: ["ebs"]
            },{
            	Name: "owner-id",
            	Values: ["679593333241"]
            }]
		}, function (err, data) {
			if (err) {
				return failure(respond(500, "Error finding NVidia AMI: " + err, false));
			}

			console.log(data.Images.length + " NVidia images found.");

			var image = {CreationDate: '1980-01-01T00:00:00.000Z'};
			data.Images.forEach(function(e) {
				if (new Date(e.CreationDate).getTime() > new Date(image.CreationDate).getTime()) {
					image = e;
				}
			});

			console.log("Using image " + JSON.stringify(image));

			return success(image);
		});
	});

	/* Doing a hackery hardcoded workaround for now.
	var map = {
		"us-east-1": "ami-0a569854f46c69795",
		// "us-east-2": "", I guess us-east-2 doesn't have the AMI?
		"us-west-1": "ami-0910dc69af49c661a",
		"us-west-2": "ami-064baf3a92b9390b9"
	};

	return map[region];
	*/
}

function createCampaign(entity, campaign) {
	console.log("Debug: Creating campaign.");
	campaign.require({
		"region": 0,
		"availabilityZone": 0,
		"instanceType": 0,
		"hashFile": 0,
		"instanceCount": 0,
		"instanceDuration": 0,
		"priceTarget": 0
	});

	var verifiedManifest = {
		rulesFiles: [],
		cognitoIdentityId: entity
	};

	if (parseInt(campaign.hashType) < 0 || parseInt(campaign.hashType > 100000)) {
		return respond(400, "hashType " + campaign.hashType + " is invalid", false);
	}

	verifiedManifest.hashType = campaign.hashType;

	if (parseInt(campaign.instanceCount) < 1 || parseInt(campaign.instanceCount) > 6) {
		return respond(400, "instanceCount must be between 1 and 6", false);
	}

	verifiedManifest.instanceCount = campaign.instanceCount;

	if (parseInt(campaign.instanceDuration) < 1 || parseInt(campaign.instanceDuration) > 24) {
		return respond(400, "instanceDuration must be between 1 and 24", false);
	}

	verifiedManifest.instanceDuration = campaign.instanceDuration;

	if (allowed_regions.indexOf(campaign.region) < 0) {
		return respond(400, campaign.region + " is not a valid or allowed region", false);
	}

	verifiedManifest.region = campaign.region;

	if (allowed_intances.indexOf(campaign.instanceType) < 0) {
		return respond(400, campaign.instanceType + " is not a valid or allowed instance type.", false);
	}

	verifiedManifest.instanceType = campaign.instanceType;

	if (parseFloat(campaign.priceTarget) < 0 || parseFloat(campaign.priceTarget) != campaign.priceTarget) {
		return respond(400, "Invalid priceTarget; must be integer greater than 0.", false);
	}

	verifiedManifest.priceTarget = campaign.priceTarget;

	try {
		var expires = /Expires=([\d]+)&/.exec(campaign.hashFileUrl)[1];
	} catch (e) {
		return respond(400, "Invalid hashFileUrl.", false);
	}

	var duration = expires - (new Date().getTime() / 1000);
	if (duration < 900) {
		return respond(400, "hashFileUrl must be valid for at least 900 seconds, got " + Math.floor(duration), false);
	}

	verifiedManifest.hashFileUrl = campaign.hashFileUrl;

	// Optional values might be present, but nulled.
	var promises = [];
	var hashfilelines = 0;
	var knownMetadata = {};
	var dictionaryKeyspace = 0;
	var dictionarySize = 0;
	var rulesKeyspace = 0;
	var rulesSize = 0;
	var lineCount = 0;

	// Verify hashfile metadata.
	promises.push(new Promise((success, failure) => {
		s3.headObject({
			Bucket: variables.userdata_bucket,
			Key: entity + '/' + campaign.hashFile
		}, function(err, data) {
			if (err) {
				return failure(respond(400, "Invalid hash file: " + err, false));
			}

			if (data.ContentType != "text/plain") {
				return failure(respond(400, "Content Type " + data.ContentType + " not permitted. Use text/plain.", false));
			}

			knownMetadata[bucket + ":" + campaign.dictionaryFile] = data.Metadata;
			// dictionaryKeyspace += data.Metadata.lines;
			// dictionarySize += data.Metadata.size + data.ContentLength;

			// verifiedManifest.dictionaryFile = campaign.dictionaryFile;

			return success();
		});
	}));

	// Verify hashfile contents.
	promises.push(new Promise((success, failure) => {
		s3.getObject({
			Bucket: variables.userdata_bucket,
			Key: entity + '/' + campaign.hashFile
		}, function(err, data) {
			if (err) {
				return failure(respond(400, "Invalid hash file contents: " + err, false));
			}

			var body = data.Body.toString('ascii');
			var lines = body.split("\n");

			lineCount = lines.length;

			verifiedManifest.hashFile = campaign.hashFile;

			return success();
		});
	}));

	if (typeof campaign.rulesFiles != "undefined" && campaign.rulesFiles != null) {
		console.log("Debug: Rules are enabled. Verifiying files.");
		campaign.require({
			"rulesFiles": 0,
			"dictionaryFile": 0
		});

		s3dict = new aws.S3({region: campaign.region});
		var bucket = variables.dictionary_buckets[campaign.region];

		// Verify dictionary
		promises.push(new Promise((success, failure) => {
			s3dict.headObject({
				Bucket: bucket,
				Key: campaign.dictionaryFile
			}, function(err, data) {
				if (err) {
					return failure(respond(400, "Invalid dictionary file: " + err, false));
				}

				knownMetadata[bucket + ":" + campaign.dictionaryFile] = data.Metadata;
				dictionaryKeyspace += data.Metadata.lines;
				dictionarySize += parseInt(data.Metadata.size) + parseInt(data.ContentLength);

				verifiedManifest.dictionaryFile = campaign.dictionaryFile;

				console.log("Debug: Dictionary file verified");
				return success();
			});
		}));

		// Verify rule files
		campaign.rulesFiles.forEach(function(e) {
			promises.push(new Promise((success, failure) => {
				s3dict.headObject({
					Bucket: bucket,
					Key: e,
				}, function(err, data) {
					if (err) {
						return failure(respond(400, "Invalid rule file: " + err, false));
					}

					knownMetadata[bucket + ":" + e] = data.Metadata;
					rulesKeyspace += data.Metadata.lines;
					rulesSize += parseInt(data.Metadata.size) + parseInt(data.ContentLength);

					verifiedManifest.rulesFiles.push(e);

					console.log("Debug: Rules files verified");
					return success();
				});
			}));
		});		
	}

	var maskKeyspace = 1;
	if (typeof campaign.mask != "undefined" && campaign.mask != null) {
		console.log("Debug: Mask is enabled. Verifying mask.");
		campaign.mask.split('?').slice(1).forEach(function(e) {
			switch (e) {
				case "l":
					maskKeyspace *= 26;
				break;

				case "u":
					maskKeyspace *= 26;
				break;

				case "d":
					maskKeyspace *= 10;
				break;

				case "s":
					maskKeyspace *= 33;
				break;

				case "a":
					maskKeyspace *= 95;
				break;

				case "b":
					maskKeyspace *= 256;
				break;

				default:
					return respond(400, "Invalid mask provided", false);
				break;
			}
		});

		verifiedManifest.mask = campaign.mask;
	}

	promises.push(getActiveCampaigns(entity).then(function(data) {
		
		data.Items.forEach(function(i) {
			i = ddbTypes.unwrap(i);

			if (i.active) {
				respond(429, "Too many active campaigns.", false);
				return Promise.reject('Too many active campaigns');
			}
		});

		console.log("Debug: No other active campaigns.");
		return Promise.resolve(true);
	}));

	Promise.all(promises).then((data) => {
		console.log("Debug: All promises returned.");

		// Compare the manifest with the verifiedManifest, and return any values that weren't processed.

		Object.keys(verifiedManifest).forEach(function(e) {
			delete campaign[e];
		});

		console.log("Debug: Processing complete. The following parameters from the campaign were not used.");
		console.log(campaign);

		var wordlistKeyspace = ((dictionaryKeyspace > 0) ? dictionaryKeyspace : 1) * ((rulesKeyspace > 0) ? rulesKeyspace : 1);

		console.log("d: " + dictionarySize);
		console.log("r: " + rulesSize);
		var wordlistSize = dictionarySize + rulesSize;
		var totalKeyspace = wordlistKeyspace * maskKeyspace;

		verifiedManifest.wordlistSize = wordlistSize;

		if (typeof verifiedManifest.dictionaryFile != "undefined") {
			if (typeof verifiedManifest.mask != "undefined") {
				verifiedManifest.attackType = 6;
			} else {
				verifiedManifest.attackType = 0;
			}
		} else {
			if (typeof verifiedManifest.mask == "undefined") {
				return respond(400, "Must have either dictionary or mask defined", false);
			}

			verifiedManifest.attackType = 3;
		}

		if (typeof verifiedManifest.rulesFiles != "undefined" && verifiedManifest.rulesFiles.length > 0) {
			verifiedManifest.attackType = 0;
		}

		if (typeof verifiedManifest.attackType == "undefined") {
			return respond(500, "Hit an impossible combination of attack types. Exiting anyway.", false);
		}

		var campaignId = uuid();
		// campaignId = "9c3ac117-ea93-4884-8e22-67cbece8dc89";
		s3.putObject({
			Body: JSON.stringify(verifiedManifest),
			Bucket: variables.userdata_bucket,
			Key: entity + '/campaigns/' + campaignId + '/manifest.json',
			ContentType: 'text/plain'
		}, function(err, data) {
			if (err) {
				return respond(500, "Failed to place campaign manifest; " + err, false);
			}

			editCampaign(entity, campaignId, {
				instanceType: verifiedManifest.instanceType,
				status: "AVAILABLE",
				active: false,
				durationSeconds: verifiedManifest.instanceDuration * 3600,
				hashType: verifiedManifest.hashType,
				hashes: lineCount,
				instanceCount: verifiedManifest.instanceCount,
				price: 0,
				targetPrice: verifiedManifest.priceTarget,
				region: verifiedManifest.region,
				startTime: Math.floor(new Date().getTime() / 1000),
				spotFleetRequestId: "<none>"
			}).then(function(data) {
				console.log("==================================================================================================");
				console.log("======     Campaign " + campaignId + " created. Preparing to execute!     ======");
				console.log("==================================================================================================");
				return respond(201, {campaignId: campaignId}, true);
				// return executeCampaign(entity, campaignId);
			}, function (err) {
				return respond(500, "Failed to set campaign readiness; " + err, false);
			});
		});
	});
}

function executeCampaign(entity, campaignId) {
	var campaign = {};
	var manifest = {};
	var image = {};

	getActiveCampaigns(entity).then(function(data) {
		
		data.Items.forEach(function(i) {
			i = ddbTypes.unwrap(i);

			if (i.active) {
				respond(429, "Too many active campaigns.", false);
				return Promise.reject(false);
			}
		});

		console.log("Debug: No other active campaigns.");
		return Promise.resolve(true);
	}).then((data) => {
		return Promise.all([
			getCampaign(entity, campaignId).then((data) => { return {campaign: data}; }),
			getCampaignManifest(entity, campaignId).then((data) => { return {manifest: data}; }),
		]);
	}).then(function (data) {
		
		data.forEach(function(e) {
			if (e.hasOwnProperty('campaign')) {
				campaign = e.campaign;
			} else {
				manifest = e.manifest;
			}
		});

		try {
			var expires = /Expires=([\d]+)&/.exec(manifest.hashFileUrl)[1];
		} catch (e) {
			return respond(400, "Invalid hashFileUrl.", false);
		}

		var duration = expires - (new Date().getTime() / 1000);
		if (duration < 900) {
			return respond(400, "hashFileUrl must be valid for at least 900 seconds, got " + Math.floor(duration), false);
		}

		return Promise.all([
			getInstanceAZs(manifest.region, manifest.instanceType).then((data) => { return null }),
			getNVidiaImage(manifest.region)
		]);

	}).then(function(data) {

		console.log(data);

		data.forEach(function(e) {
			if (e != null) {
				image = e;
			}
		});

		// Calculate the necessary volume size
		var volumeSize = Math.ceil(manifest.wordlistSize / 1073741824) + 1;
		// with a minimum of 10GB
		// volumeSize = (volumeSize > 10) ? volumeSize : 10;

		// Build a launchSpecification for each AZ in the target region.
		var launchSpecifications = [];
		var launchSpecificationTemplate = {
			IamInstanceProfile: {
				Arn: variables.instanceProfile
			},
			ImageId: image.ImageId,
			KeyName: "npk-key",
			InstanceType: manifest.instanceType,
			BlockDeviceMappings: [{
				DeviceName: '/dev/xvdb',
				Ebs: {
					DeleteOnTermination: true,
					Encrypted: false,
					VolumeSize: volumeSize,
					VolumeType: "gp2"
				}
			}],
			NetworkInterfaces: [{
				AssociatePublicIpAddress: true,
				DeviceIndex: 0,
				// SubnetId: ""
			}],
			Placement: {
				AvailabilityZone: ""
			},
			TagSpecifications: [{
				ResourceType: "instance",
				Tags: [{
					Key: "MaxCost",
					Value: ((manifest.priceTarget < variables.campaign_max_price) ? manifest.priceTarget : variables.campaign_max_price).toString()
				}, {
					Key: "ManifestPath",
					Value: entity + '/campaigns/' + campaignId
				}]
			}],
			UserData: fs.readFileSync(__dirname + '/userdata.sh', 'base64')
		};

		Object.keys(knownInstanceAZs[manifest.instanceType][manifest.region]).forEach(function(e) {
			var az = JSON.parse(JSON.stringify(launchSpecificationTemplate)); 	// Have to deep-copy to avoid referential overrides.
			az.Placement.AvailabilityZone = e;
			az.NetworkInterfaces[0].SubnetId = variables.availabilityZones[manifest.region][e];

			launchSpecifications.push(az);
		});

		var spotPrice = getObjectAverage(knownInstanceAZs[manifest.instanceType][manifest.region]);
		var maxDuration = (Number(manifest.instanceDuration) < variables.campaign_max_price / spotPrice) ? Number(manifest.instanceDuration) : variables.campaign_max_price / spotPrice;

		console.log(spotPrice, maxDuration, variables.campaign_max_price);

		var spotFleetParams = {
			SpotFleetRequestConfig: {
				AllocationStrategy: "lowestPrice",
				IamFleetRole: variables.iamFleetRole,
				InstanceInterruptionBehavior: "terminate",
				LaunchSpecifications: launchSpecifications,
				SpotPrice: (manifest.priceTarget / (manifest.instanceCount * manifest.instanceDuration) * 2).toString(),
				TargetCapacity: manifest.instanceCount,
				ReplaceUnhealthyInstances: false,
				TerminateInstancesWithExpiration: true,
				Type: "request",
				ValidFrom: (new Date().getTime() / 1000),
				ValidUntil: (new Date().getTime() / 1000) + (maxDuration * 3600)
			}
		};

		console.log(JSON.stringify(spotFleetParams));

		// Submit the fleet request.
		var ec2 = new aws.EC2({region: manifest.region});
		ec2.requestSpotFleet(spotFleetParams, function (err, data) {
			if (err) {
				return respond(500, "Error requesting spot fleet: " + err, false);
			}

			editCampaign(entity, campaignId, {
				active: true,
				status: "STARTING",
				spotFleetRequestId: data.SpotFleetRequestId,
				startTime: Math.floor(new Date().getTime() / 1000)
			}).then(function(tmp) {
				console.log("Campaign " + campaignId + " started.");
				return respond(200, {msg: "Campaign started successfully", campaignId: campaignId, spotFleetRequestId: data.SpotFleetRequestId}, true);
			}, function (err) {
				return respond(500, "Failed to set campaign as active. " + err, false);
			});
		});


	}, function (err) {
		respond(500, "Unable to retrieve campaign for execution.", false);
	});

	// return respond(200, "Campaign " + campaignId + " started.", true);
}

function stopCampaign(entity, campaignId) {

	getCampaign(entity, campaignId).then(function(data) {
		if (data.Items.length < 1) {
			return respond(404, "Campaign " + campaignId + " not found", false);
		}

		var campaign = ddbTypes.unwrap(data.Items[0]);
		var ec2 = new aws.EC2({region: campaign.region});

		ec2.describeSpotFleetRequests({
			SpotFleetRequestIds: [campaign.spotFleetRequestId]
		}, function(err, fleet) {
			if (err) {
				return respond(500, "Error retrieving spot fleet data: " + err, false);
			}

			if (fleet.SpotFleetRequestConfigs.length < 1) {
				// TODO: Set the campaign to inactive if this result is reliable enough.
				return respond(404, "Error retrieving spot fleet data: not found.", false);
			}

			var request = fleet.SpotFleetRequestConfigs[0];
			if (request.SpotFleetRequestState == "active") {
				ec2.cancelSpotFleetRequests({
					SpotFleetRequestIds: [campaign.spotFleetRequestId],
					TerminateInstances: true
				}, function(err, response) {
					if (err) {
						return respond(500, "Error cancelling spot fleet: " + err, false);
					}

					console.log(response);

					if (response.SuccessfulFleetRequests.length < 1) {
						return respond(500, "Error cancelling spot fleet: " + err, false);
					}

					if (response.SuccessfulFleetRequests[0].CurrentSpotFleetRequestState.indexOf('cancelled') < 0) {
						return respond(400, "Error cancelling spot fleet. Current state: " + response.SuccessfulFleetRequests[0].CurrentSpotFleetRequestState, false);
					}

					editCampaign(entity, campaignId, {
						active: false
					}).then(function(data) {
						return respond(200, "Campaign stoppped.", true);
					}, function (err) {
						return respond(500, "Unable to deactivate campaign: " + err, false);
					});
				});
			} else {
				editCampaign(entity, campaignId, {
					active: false,
					status: "CANCELLED"
				}).then(function(data) {
					return respond(200, "Campaign stoppped.", true);
				}, function (err) {
					return respond(500, "Unable to deactivate campaign: " + err, false);
				});
			}
		});

	}, function (err) {
		return respond(500, "Error retrieving campaign: " + err, false);
	});
}

function processHttpRequest(path, method, entity, body) {
	var params = path.split("/");

	switch (params[0]) {
		case "campaign":
			if (typeof params[1] == "undefined") {
				switch (method) {
					case "POST":
						return createCampaign(entity, body);
					break;

					default:
						return invalidMethod(path, method);
					break;
				}
			} else {
				if (!/^[0-9a-z\-]{36}$/.test(params[1])) {
					return respond(404, "Campaign not found", false);
				}

				switch (method) {
					case "PUT":
						return executeCampaign(entity, params[1]);
					break;

					case "DELETE":
						return getCampaign(entity, params[1]).then((data) => {

							console.log(data);

							if (data.Items.length < 1) {
								return respond(404, "Invalid campaign", false);
							}

							data = ddbTypes.unwrap(data.Items[0]);

							if (data.status == "RUNNING") {
								return stopCampaign(entity, params[1]);
							} else {
								return deleteCampaign(entity, params[1]);
							}
						});
					break;

					default:
						return invalidMethod(path, method);
					break;
				}
			}
		break;
	}

	return respond(404, "Not found.", false);
}

function respond(statusCode, body, success) {


	// Include terraform dns names as allowed origins, as well as localhost.
	var allowed_origins = variables.www_dns_names;
	allowed_origins.push("https://localhost");

	var headers = {'Content-Type': 'text/plain'};
	if (allowed_origins.indexOf(origin) !== false) {
		// Echo the origin back. I guess this is the best way to support multiple origins
		headers['Access-Control-Allow-Origin'] = origin;
	}

	switch (typeof body) {
		case "string":
			body = { msg: body, success: success };
		break;

		case "object":
			body.success = success;
		break;
	}

	cb(null, {
		statusCode: statusCode,
		headers: headers,
		body: JSON.stringify(body),
	});

	if (success == true) {
		return Promise.resolve(body.msg);
	} else {
		return Promise.reject(body.msg);
	}
}

exports.main = function(event, context, callback) {

	// Hand off the callback function for later.
	cb = callback;

	var allowed_characters = /^[a-zA-Z0-9'"%\.\[\]\{\}\(\)\-\:\\\/\;\=\?\#\_+\s,&]+$/;
	if (!allowed_characters.test(JSON.stringify(event))) {
		return respond(400, "Illegal request", false);
	}

	// Try/Catch the whole thing. Cause why not.
	try {

		console.log("Received event: " + JSON.stringify(event));

		event.require({
			"body": 0,
			"isBase64Encoded": 0,
			"headers": 0,
			"httpMethod": 0,
			"pathParameters": {
				"proxy": 0
			},
			"queryStringParameters": 0,
			"requestContext": {
				"requestId": 0,
				"identity": {
					"cognitoIdentityId": 0,
					"cognitoAuthenticationType": 0
				}
			}
		});

		// Hand off the origin, too. Fix for weird case
		origin = event.headers.origin || event.headers.Origin;

		if (event.requestContext.identity.cognitoAuthenticationType != "authenticated") {
			return respond(401, "Authentication Required", false);
		}

		var body = {};
		// Unencode the body if necessary
		if (event.body != null) {
			body = (event.requestContext.isBase64Encoded) ? atob(event.body) : event.body;

			// Body will always be a JSON object.
			try {
				body = JSON.parse(body);
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