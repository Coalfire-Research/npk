const accountDetails = require('./accountDetails.json');

const aws = require('aws-sdk');
const ddb = new aws.DynamoDB({ region: accountDetails.primaryRegion });
const s3 = new aws.S3({ region: accountDetails.primaryRegion });

let cb = "";
let variables = {};

var cognito = new aws.CognitoIdentityServiceProvider({region: accountDetails.primaryRegion, apiVersion: "2016-04-18"});

exports.main = async function(event, context, callback) {

	console.log(JSON.stringify(event));

	// Hand off the callback function for later.
	cb = callback;

	// Get the available envvars into a usable format.
	variables = JSON.parse(JSON.stringify(process.env));

	let entity, UserPoolId, sub;

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

		// Associate the user identity.
		[ UserPoolId,, sub ] = event?.requestContext?.identity?.cognitoAuthenticationProvider?.split('/')[2]?.split(':');

		if (!UserPoolId || !sub) {
			console.log(`UserPoolId or sub is missing from ${event?.requestContext?.identity?.cognitoAuthenticationProvider}`);
			respond(401, {}, "Authorization Required", false);
		}

	} catch (e) {
		console.log("Failed to process request.", e);
		return respond(500, {}, "Failed to process request.", false);
	}

	let user, email, Username;

	try {
		// Get the user based on 'sub'. This is needed when the IdP isn't Cognito itself.
		let userList = await cognito.listUsers({ UserPoolId, Filter: `sub = "${sub}"` }).promise();

		if (!userList.Users?.[0]?.Username) {
			console.log("Unable to find Cognito user from Subscriber ID.", e);
			return respond(500, {}, "Unable to find Cognito user from Subscriber ID.", false);
		}

		Username = userList.Users[0].Username;

		user = await cognito.adminGetUser({ UserPoolId, Username }).promise();

		// Restructure UserAttributes as an k:v
		user.UserAttributes = user.UserAttributes.reduce((attrs, entry) => {
			attrs[entry.Name] = entry.Value

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

	const campaignId = event?.pathParameters?.campaign;

	// Get the campaign entry from DynamoDB, and manifest from S3.
	// * In parallel, to save, like, some milliseconds.

	let campaign;

	try {
		campaign = await ddb.query({
			ExpressionAttributeValues: {
				':id': {S: entity},
				':keyid': {S: `campaigns:${campaignId}`}
			},
			KeyConditionExpression: 'userid = :id and keyid = :keyid',
			TableName: "Campaigns"
		}).promise();

		campaign = aws.DynamoDB.Converter.unmarshall(campaign.Items[0]);

	} catch (e) {
		console.log("Failed to retrieve campaign details.", e);
		return respond(500, {}, "Failed to retrieve campaign details.");
	}

	if (!campaign.status) {
		return respond(404, {},  "Specified campaign does not exist.", false);
	}

	console.log(`[+] Campaign ${campaignId} is associated with SFR ${campaign.spotFleetRequestId}`);

	var ec2 = new aws.EC2({region: campaign.region});

	switch (campaign.status) {
		case "STARTING":
		case "RUNNING": 

			let sfr;

			try {
				sfr = await ec2.describeSpotFleetRequests({
					SpotFleetRequestIds: [campaign.spotFleetRequestId]
				}).promise();
			} catch(e) {

				let update = await ddb.updateItem({
					Key: {
						userid: {S: entity},
						keyid: {S: `campaigns:${campaignId}`}
					},
					TableName: "Campaigns",
					AttributeUpdates: {
						active: { Action: 'PUT', Value: { BOOL: false }},
						status: { Action: 'PUT', Value: { S: "CANCELLED" }}
					}
				}).promise();

				console.log("Failed to retrieve spot fleet request.", e);
				return respond(500, {}, "Failed to retrieve spot fleet request.", false);
			}

			if (!sfr.SpotFleetRequestConfigs?.[0]?.SpotFleetRequestId) {

				let update = await ddb.updateItem({
					Key: {
						userid: {S: entity},
						keyid: {S: `campaigns:${campaignId}`}
					},
					TableName: "Campaigns",
					AttributeUpdates: {
						active: { Action: 'PUT', Value: { BOOL: false }},
						status: { Action: 'PUT', Value: { S: "CANCELLED" }}
					}
				}).promise();

				return respond(404, "Error retrieving spot fleet data: not found.", false);
			}

			if (sfr.SpotFleetRequestConfigs[0].SpotFleetRequestState == "active") {
				let cancellation;

				try {
					cancellation = await ec2.cancelSpotFleetRequests({
						SpotFleetRequestIds: [sfr.SpotFleetRequestConfigs[0].SpotFleetRequestId],
						TerminateInstances: true
					}).promise();
				} catch(e) {
					console.log("Failed to request cancellation of spot fleet request.", e);
					return respond(500, {}, "Failed to request cancellation of spot fleet request.", false);
				}

				if (cancellation?.SuccessfulFleetRequests?.[0].CurrentSpotFleetRequestState?.indexOf('cancelled') < 0) {
					return respond(400, "Error cancelling spot fleet. Current state: " + cancallation.SuccessfulFleetRequests[0].CurrentSpotFleetRequestState, false);
				}
			}

			try {
				let update = await ddb.updateItem({
					Key: {
						userid: {S: entity},
						keyid: {S: `campaigns:${campaignId}`}
					},
					TableName: "Campaigns",
					AttributeUpdates: {
						active: { Action: 'PUT', Value: { BOOL: false }},
						status: { Action: 'PUT', Value: { S: "CANCELLED" }}
					}
				}).promise();
			} catch(e) {
				console.log("Failed to deactivate campaign.", e);
				return respond(500, {}, "Failed to deactivate campaign.", false);
			}

			return respond(200, {}, `Campaign ${campaignId} stopped.`, true);

		break;

		default:

			let entries;

			try {
				entries = await ddb.query({
					ExpressionAttributeValues: {
						':id': {S: entity},
						':keyid': {S: `${campaignId}:`}
					},
					KeyConditionExpression: 'userid = :id and begins_with(keyid, :keyid)',
					TableName: "Campaigns"
				}).promise();
			} catch (e) {
				console.log("Failed to retrieve events for campaign.", e);
				return respond(500, {}, "Failed to retrieve events for campaign.", false);
			}

			try {

				// Delete event entries for the campaign.
				const promises = entries.Items.map((entry) => {
					entry = aws.DynamoDB.Converter.unmarshall(entry);

					return ddb.deleteItem({
						Key: {
							userid: {S: entity},
							keyid: {S: entry.keyid}
						},
						TableName: "Campaigns"
					}).promise();
				});

				promises.push(ddb.updateItem({
					Key: {
						userid: {S: entity},
						keyid: {S: `campaigns:${campaignId}`}
					},
					TableName: "Campaigns",
					AttributeUpdates: {
						deleted: { Action: 'PUT', Value: { BOOL: true }}
					}
				}).promise());

				let finished = await Promise.all(promises);

			} catch (e) {
				console.log("Failed to delete campaign", e);
				return respond(500, {}, "Failed to delete campaign", false);
			}

			return respond(200, {}, `Campaign ${campaignId} deleted.`, true);

		break;
	}

	

	return respond(200, {}, { msg: "Campaign started successfully", campaignId: campaignId, spotFleetRequestId: spotFleetRequest.SpotFleetRequestId }, true);
}

function respond(statusCode, headers, body, success) {

	// Include terraform dns names as allowed origins, as well as localhost.
	const allowed_origins = [variables.www_dns_names, "https://localhost"];

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

	return Promise.resolve(body.msg);
}