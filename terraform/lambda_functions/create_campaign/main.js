const aws = require('aws-sdk');
const uuid = require('uuid/v4');

const ddb = new aws.DynamoDB({ region: "us-west-2" });
const s3 = new aws.S3({ region: "us-west-2" });

var cognito = new aws.CognitoIdentityServiceProvider({region: "us-west-2", apiVersion: "2016-04-18"});

let cb = "";
let variables = {};

var allowed_regions = [
	"us-west-1",
	"us-west-2",
	"us-east-1",
	"us-east-2"
];

var allowed_instances = [
	// "g3s.xlarge",
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

var vcpus = {
	"g3.4xlarge": 16,
	"g3.8xlarge": 32,
	"g3.16xlarge": 64,

	"p2.xlarge": 4,
	"p2.8xlarge": 32,
	"p2.16xlarge": 64,

	"p3.2xlarge": 8,
	"p3.8xlarge": 32,
	"p3.16xlarge": 64
}

exports.main = async function(event, context, callback) {

	console.log(JSON.stringify(event));

	// Hand off the callback function for later.
	cb = callback;

	// Get the available envvars into a usable format.
	variables = JSON.parse(JSON.stringify(process.env));
	variables.availabilityZones = JSON.parse(variables.availabilityZones);
	variables.dictionaryBuckets = JSON.parse(variables.dictionaryBuckets);

	let entity, campaign, UserPoolId, Username;

	try {

		console.log("Received event: " + JSON.stringify(event));

		// Hand off the origin, too. Fix for weird case
		origin = event?.headers?.origin ?? event?.headers?.Origin;

		var allowed_characters = /^[a-zA-Z0-9'"%\.\[\]\{\}\(\)\-\:\\\/\;\=\?\#\_+\s,!@#\$\^\*&]+$/;
		if (!allowed_characters.test(JSON.stringify(event))) {
			console.log("Request contains illegal characters");
			return respond(400, {}, "Request contains illegal characters", false);
		}

		if (event?.requestContext?.identity?.cognitoAuthenticationType != "authenticated") {
			console.log(`cognitoAuthenticationType ${event?.requestContext?.identity?.cognitoAuthenticationType} != "authenticated"`)
			return respond(401, {}, "Authentication Required", false);
		}

		entity = event.requestContext.identity.cognitoIdentityId;

		let body = {};
		// Unencode the body if necessary
		if (!!event?.body) {
			body = (event.requestContext.isBase64Encoded) ? atob(event.body) : event.body;

			// Body will always be a JSON object.
			try {
				body = JSON.parse(body);
			} catch (e) {
				return respond(400, {}, "Body must be JSON object", false);
			}
		}

		campaign = body;

		// Associate the user identity.
		[ UserPoolId,, Username ] = event?.requestContext?.identity?.cognitoAuthenticationProvider?.split('/')[2]?.split(':');

		if (!UserPoolId || !Username) {
			console.log(`UserPoolId or Username is missing from ${event?.requestContext?.identity?.cognitoAuthenticationProvider}`);
			respond(401, {}, "Authorization Required", false);
		}

	} catch (e) {
		console.log("Failed to process request.", e);
		return respond(500, {}, "Failed to process request.", false);
	}

	let user, email;

	try {
		user = await cognito.adminGetUser({ UserPoolId, Username }).promise();

		// Restructure UserAttributes as an k:v
		user.UserAttributes = user.UserAttributes.reduce((attrs, entry) => {
			attrs[entry.Name] = entry.Value;

			return attrs;
		}, {});

		if (!user?.UserAttributes?.email) {
			return respond(401, {}, "Unable to obtain user properties.", false);
		}

		email = user.UserAttributes.email;
			
	} catch (e) {
		console.log("Unable to retrieve user context.", e);
		return respond(500, {}, "Unable to retrieve user context.", false);
	}

	console.log(event.pathParameters)

	// Verify that required elements are present:
	const missingElements = [
		"region",
		"availabilityZone",
		"instanceType",
		"hashFile",
		"instanceCount",
		"instanceDuration",
		"priceTarget"
	].reduce((missing, entry) => {
		if (!campaign[entry]) {
			missing.push[entry];
		}

		return missing;
	}, []);

	if (missingElements.length > 0) {
		return respond(400, {}, `Campaign missing required elements [${missingElements.join(', ')}]`);
	}

	const verifiedManifest = {
		rulesFiles: [],
		cognitoIdentityId: entity
	};

	if (parseInt(campaign.hashType) < 0 || parseInt(campaign.hashType > 100000)) {
		return respond(400, {}, "hashType " + campaign.hashType + " is invalid", false);
	}

	verifiedManifest.hashType = campaign.hashType;

	if (parseInt(campaign.instanceCount) < 1 || parseInt(campaign.instanceCount) > 6) {
		return respond(400, {}, "instanceCount must be greater than 1", false);
	}

	verifiedManifest.instanceCount = campaign.instanceCount;

	if (parseInt(campaign.instanceDuration) < 1 || parseInt(campaign.instanceDuration) > 24) {
		return respond(400, {}, "instanceDuration must be between 1 and 24", false);
	}

	verifiedManifest.instanceDuration = campaign.instanceDuration;

	if (allowed_regions.indexOf(campaign.region) < 0) {
		return respond(400, {}, campaign.region + " is not a valid or allowed region", false);
	}

	verifiedManifest.region = campaign.region;

	if (Object.keys(vcpus).indexOf(campaign.instanceType) < 0) {
		return respond(400, {}, campaign.instanceType + " is not a valid or allowed instance type.", false);
	}

	let quota = 0;
	switch (campaign.instanceType.split("")[0]) {
		case 'g':
			quota = variables.gQuota;
		break;

		case 'p':
			quota = variables.pQuota;
		break;

		default:
			return respond(400, {}, "Unable to determine applicable quota for " + campaign.instanceType, false);
		break;
	}

	const neededVCPUs = vcpus[campaign.instanceType] * parseInt(campaign.instanceCount);
	if (quota < neededVCPUs) {
		return respond(400, {}, "Order exceeds account quota limits. Needs " + neededVCPUs + " but account is limited to " + quota, false);
	}

	verifiedManifest.instanceType = campaign.instanceType;

	if (parseFloat(campaign.priceTarget) < 0 || parseFloat(campaign.priceTarget) != campaign.priceTarget) {
		return respond(400, {}, "Invalid priceTarget; must be integer greater than 0.", false);
	}

	verifiedManifest.priceTarget = campaign.priceTarget;

	let expires;

	try {
		expires = /Expires=([\d]+)&/.exec(campaign.hashFileUrl)[1];
	} catch (e) {
		return respond(400, {}, "Invalid hashFileUrl.", false);
	}

	const duration = expires - (new Date().getTime() / 1000);
	if (duration < 900) {
		return respond(400, {}, "hashFileUrl must be valid for at least 900 seconds, got " + Math.floor(duration), false);
	}

	verifiedManifest.hashFileUrl = campaign.hashFileUrl;

	if (campaign.manualArguments) {
		verifiedManifest.manualArguments = campaign.manualArguments;
	}

	if (campaign.manualMask) {
		if (campaign.mask || campaign.rulesFiles || campaign.dictionaryFile) {
			return respond(400, {}, "Manual masks cannot be combined with any other attack type.", false);
		}

		verifiedManifest.manualMask = campaign.manualMask;
	}

	// Optional values might be present, but nulled.
	const promises = [];
	const knownMetadata = {};

	let hashfilelines = 0;
	let dictionaryKeyspace = 0;
	let dictionarySize = 0;
	let rulesKeyspace = 0;
	let rulesSize = 0;
	let lineCount = 0;

	try {

		// Verify hashfile metadata.
		promises.push(new Promise((success, failure) => {
			s3.headObject({
				Bucket: variables.userdata_bucket,
				Key: entity + '/' + campaign.hashFile
			}, function(err, data) {
				if (err) {
					return failure(respond(400, {}, "Invalid hash file: " + err, false));
				}

				if (data.ContentType != "text/plain") {
					return failure(respond(400, {}, "Content Type " + data.ContentType + " not permitted. Use text/plain.", false));
				}

				knownMetadata[bucket + ":" + campaign.dictionaryFile] = data.Metadata;

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
					return failure(respond(400, {}, "Invalid hash file contents: " + err, false));
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

			// Verify that required elements are present:
			let missingElements = [
				"rulesFile",
				"dictionaryFile"
			].reduce((missing, entry) => {
				if (!campaign[entry]) {
					missing.push[entry];
				}

				return missing;
			}, []);

			if (missingElements.length > 0) {
				return respond(400, {}, `Rule-based campaign missing required elements [${missingElements.join(', ')}]`);
			}

			s3dict = new aws.S3({region: campaign.region});
			var bucket = variables.dictionaryBuckets[campaign.region];

			console.log(variables.dictionaryBuckets);

			// Verify dictionary
			promises.push(new Promise((success, failure) => {
				s3dict.headObject({
					Bucket: bucket,
					Key: campaign.dictionaryFile
				}, function(err, data) {
					if (err) {
						return failure(respond(400, {}, "Invalid dictionary file: " + err, false));
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
							return failure(respond(400, {}, "Invalid rule file: " + err, false));
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
						return respond(400, {}, "Invalid mask provided", false);
					break;
				}
			});

			verifiedManifest.mask = campaign.mask;
		}

		await Promise.all(promises).then((data) => {
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
				if (typeof verifiedManifest.mask == "undefined" && typeof verifiedManifest.manualMask == "undefined") {
					return respond(400, {}, "Must have either dictionary or mask defined", false);
				}

				verifiedManifest.attackType = 3;
			}

			if (typeof verifiedManifest.rulesFiles != "undefined" && verifiedManifest.rulesFiles.length > 0 && typeof verifiedManifest.manualMask == "undefined") {
				verifiedManifest.attackType = 0;
			}

			if (typeof verifiedManifest.attackType == "undefined") {
				return respond(500, {}, "Hit an impossible combination of attack types. Exiting.", false);
			}
		});
	} catch (e) {
		console.log("Campaign creation failed after validation.", e);
		return respond(500, {}, "Campaign creation failed after validation.", false)
	}

	const campaignId = uuid();
	let putManifest, editCampaign;

	try {

		putManifest = await s3.putObject({
			Body: JSON.stringify(verifiedManifest),
			Bucket: variables.userdata_bucket,
			Key: entity + '/campaigns/' + campaignId + '/manifest.json',
			ContentType: 'text/plain'
		}).promise();

	} catch (e) {
		console.log("Failed to place manifest file.", e);
		return respond(500, {}, "Failed to place manifest file.", false)
	}

	try {
		const updateParams = aws.DynamoDB.Converter.marshall({
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
			spotFleetRequestId: "<none>",
			cognitoUserEmail: email,
			deleted: false
		});

		const updateCampaign = await ddb.updateItem({
			Key: {
				userid: {S: entity},
				keyid: {S: `campaigns:${campaign}`}
			},
			TableName: "Campaigns",
			AttributeUpdates: Object.keys(updateParams).reduce((attrs, entry) => {
				attrs[entry] = {
					Action: "PUT",
					Value: updateParams[entry]
				};

				return attrs;
			}, {})
		}).promise();
	} catch (e) {
		console.log("Failed to update campaign record.", e);
		return respond(500, {}, "Failed to update campaign record.", false)
	}

	console.log("==================================================================================================");
	console.log("======     Campaign " + campaignId + " created. Preparing to execute!     ======");
	console.log("==================================================================================================");

	return respond(201, {}, {campaignId: campaignId}, true);
}

function respond(statusCode, headers, body, success) {

	// Include terraform dns names as allowed origins, as well as localhost.
	const allowed_origins = [variables.www_dns_names];
	allowed_origins.push("https://localhost");

	headers['Content-Type'] = 'text/plain';

	if (allowed_origins.indexOf(origin) !== false) {
		// Echo the origin back. I guess this is the best way to support multiple origins
		headers['Access-Control-Allow-Origin'] = origin;
	} else {
		console.log("Invalid origin received.", origin);
	}

	switch (typeof body) {
		case "string":
			body = { msg: body, success: success };
		break;

		case "object":
			body.success = success;
		break;
	}

	const response = {
		statusCode: statusCode,
		headers: headers,
		body: JSON.stringify(body),
	}

	console.log(JSON.stringify(response));

	cb(null, response);

	if (success == true) {
		return Promise.resolve(body.msg);
	} else {
		return Promise.reject(body.msg);
	}
}