const aws = require('aws-sdk');
const ddb = new aws.DynamoDB({ region: "us-west-2" });
const s3 = new aws.S3({ region: "us-west-2" });

let cb = "";
let variables = {};

exports.main = async function(event, context, callback) {

	// Hand off the callback function for later.
	cb = callback;

	// Get the available envvars into a usable format.
	variables = JSON.parse(JSON.stringify(process.env));

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

		var body = {};
		// Unencode the body if necessary
		if (!!event?.body) {
			body = (event.requestContext.isBase64Encoded) ? atob(event.body) : event.body;

			// Body will always be a JSON object.
			try {
				body = JSON.parse(body);
			} catch (e) {
				return respond(400, "Body must be JSON object", false);
			}
		}

		// Associate the user identity.
		const [ UserPoolId,, Username ] = event?.requestContext?.identity?.cognitoAuthenticationProvider?.split('/')[2]?.split(':');

		if (!UserPoolId || !Username) {
			console.log(`UserPoolId or Username is missing from ${event?.requestContext?.identity?.cognitoAuthenticationProvider}`);
			respond(401, "Authorization Required");
		}

	} catch (e) {
		console.log("Failed to process request.", e);
		return respond(500, {}, "Failed to process request.", false);
	}

	try {
		const user = await cognito.adminGetUser({ UserPoolId, Username }).promise();

		// Restructure UserAttributes as an k:v
		user.UserAttributes = user.UserAttributes.reduce((attrs, entry) => {
			attrs[entry.Name] = entry.Value
		}, {});

		if (!user?.UserAttributes?.email) {
			return respond(401, {}, "Unable to obtain user properties.", false);
		}
			
	} catch (e) {
		console.log("Unable to retrieve user context.", e);
		return respond(500, {}, "Unable to retrieve user context.", false);
	}

	console.log(event.pathParameters)

	const campaignId = event?.pathParameters?.campaign;

	// Get the campaign entry from DynamoDB, and manifest from S3.
	// * In parallel, to save, like, some milliseconds.

	try {
		const [campaign, manifestObject] = await Promise.all([
			ddb.query({
				ExpressionAttributeValues: {
					':id': {S: entity},
					':keyid': {S: `campaigns:${campaignId}`}
				},
				KeyConditionExpression: 'userid = :id and keyid = :keyid',
				TableName: "Campaigns"
			}).promise(),

			s3.getObject({
				Bucket: variables.userdata_bucket,
				Key: `${entity}/campaigns/${campaign}/manifest.json`
			}).promise()
		]);

		const manifest = JSON.parse(manifestObject.Body.toString('ascii'));
	} catch (e) {
		console.log("Failed to retrieve campaign details.", e);
		return respond(500, {}, "Failed to retrieve campaign details.");
	}

	if (campaign.Items?.[0]?.status?.S != "AVAILABLE") {
		return respond(404, {}, "Campaign doesn't exist or is not in 'AVAILABLE' status.");
	}

	console.log(campaign, manifest);

	// Test whether the provided presigned URL is expired.

	try {
		var expires = /Expires=([\d]+)&/.exec(manifest.hashFileUrl)[1];
	} catch (e) {
		return respond(400, "Invalid hashFileUrl; missing expiration");
	}

	var duration = expires - (new Date().getTime() / 1000);
	if (duration < 900) {
		return respond(400, {} `hashFileUrl must be valid for at least 900 seconds, got ${Math.floor(duration)}`);
	}

	// Campaign is valid. Get AZ pricing and Image AMI
	// * Again in parallel, to save, like, some more milliseconds.

	try {
		const ec2 = new aws.EC2({region: manifest.region});
		const [pricing, image] = await Promise.all([
			ec2.describeSpotPriceHistory({
				EndTime: Math.round(Date.now() / 1000),
				ProductDescriptions: [ "Linux/UNIX (Amazon VPC)" ],
				InstanceTypes: [ manifest.instanceType ],
				StartTime: Math.round(Date.now() / 1000)
			}),

			ec2.describeImages({
				Filters: [{
	                Name: "virtualization-type",
	                Values: ["hvm"]
	            },{
	            	Name: "name",
	            	Values: ["amzn2-ami-graphics-hvm-2*"]
	            },{
	            	Name: "root-device-type",
	            	Values: ["ebs"]
	            },{
	            	Name: "owner-id",
	            	Values: ["679593333241"]
	            }]
			})
		]);
	} catch (e) {
		console.log("Failed to retrieve price and image details.", e);
		return respond(500, {}, "Failed to retrieve price and image details.");
	}

	try {

		// Calculate the necessary volume size

		const volumeSize = Math.ceil(manifest.wordlistSize / 1073741824) + 1;
		console.log(`Wordlist is ${manifest.wordlistSize / 1073741824}GiB. Allocating ${volumeSize}GiB`);

		// Build a launchSpecification for each AZ in the target region.

		const instance_userdata = new Buffer(fs.readFileSync(__dirname + '/userdata.sh', 'utf-8')
			.replace("{{APIGATEWAY}}", process.env.apigateway))
			.toString('base64');

		const launchSpecificationTemplate = {
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
				// SubnetId: Gets populated below.
			}],
			Placement: {
				// AvailabilityZone: Gets populated below.
			},
			TagSpecifications: [{
				ResourceType: "instance",
				Tags: [{
					Key: "MaxCost",
					Value: ((manifest.priceTarget < variables.campaign_max_price) ? manifest.priceTarget : variables.campaign_max_price).toString()
				}, {
					Key: "ManifestPath",
					Value: `${entity}/campaigns/${campaignId}`
				}]
			}],
			UserData: instance_userdata
		};

		// Create a copy of the launchSpecificationTemplate for each AvailabilityZone in the campaign's region.

		const launchSpecifications = Object.keys(variables.availabilityZones[manifest.region]).reduce((specs, entry) => {
			const az = JSON.parse(JSON.stringify(launchSpecificationTemplate)); // Have to deep-copy to avoid referential overrides.

			az.Placement.AvailabilityZone = entry;
			az.NetworkInterfaces[0].SubnetId = variables.availabilityZones[manifest.region][entry];

			return specs.concat(az);
		}, []);

		// Get the average spot price across all AZs in the region.
		const spotPrice = pricing.reduce((average, entry) => average + (entry / pricing.length), 0);
		const maxDuration = (Number(manifest.instanceDuration) < variables.campaign_max_price / spotPrice) ? Number(manifest.instanceDuration) : variables.campaign_max_price / spotPrice;

		console.log(spotPrice, maxDuration, variables.campaign_max_price);

		const spotFleetParams = {
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
	} catch (e) {
		console.log("Failed to generate launch specifications.", e);
		return respond(500, {}, "Failed to generate launch specifications.");
	}

	try {
		const spotFleetRequest = await ec2.requestSpotFleet(spotFleetParams).promise();
	} catch (e) {
		console.log("Failed to request spot fleet.", e);
		return respond(500, {}, "Failed to request spot fleet.");
	}

	// Campaign created successfully.

	console.log(`Successfully requested spot fleet ${spotFleetRequest.SpotFleetRequestId}`);

	try {
		const updateCampaign = await ddb.updateItem({
			Key: {
				userid: {S: entity},
				keyid: {S: `campaigns:${campaign}`}
			},
			TableName: "Campaigns",
			AttributeUpdates: {
				active: { Action: "PUT", Value: { BOOL: true }},
				status: { Action: "PUT", Value: { S: "STARTING" }},
				spotFleetRequestId: { Action: "PUT", Value: { S: data.SpotFleetRequestId }},
				startTime: { Action: "PUT", Value: { N: Math.floor(new Date().getTime() / 1000) }},
				eventType: { Action: "PUT", Value: { S: "CampaignStarted" }}
			}
		}).promise();
	} catch (e) {
		console.log("Spot fleet submitted, but failed to mark Campaign as 'STARTING'. This is a catastrophic error.", e);
		return respond(500, {}, "Spot fleet submitted, but failed to mark Campaign as 'STARTING'. This is a catastrophic error.", false);
	}

	return respond(200, {}, { msg: "Campaign started successfully", campaignId: campaignId, spotFleetRequestId: spotFleetRequest.SpotFleetRequestId }, true);
}

function respond(statusCode, headers, body, success) {

	// Include terraform dns names as allowed origins, as well as localhost.
	const allowed_origins = JSON.parse(variables.www_dns_names);
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