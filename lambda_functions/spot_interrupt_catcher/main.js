'use strict';

const aws = require("aws-sdk");
const settings = JSON.parse(JSON.stringify(process.env));

exports.main = async function (event, context, callback) {
	console.log(JSON.stringify(event));
	if (event['detail-type'] != "EC2 Spot Instance Interruption Warning") {
		console.log(`[!] Wrong event type received. Got: ${event['detail-type']}`);
		return callback("Wrong event type received");
	}

	if (!event.region || !event.detail?.['instance-id']) {
		console.log(`[!] Event is missing critical details.`);
		return callback("Event is missing critical details");
	}

	let instance, instanceId;

	try {
		instanceId = event.detail['instance-id'];

		console.log(`[+] Caught interruption event for instance ${instanceId}`);

		const ec2 = new aws.EC2({ region: event.region });

		// Get details for the instance to be terminated:
		instance = await ec2.describeInstances({
			Filters: [{
				Name: "instance-id",
				Values: [ instanceId ]
			}]
		}).promise();

		instance = instance.Reservations[0].Instances[0];

		// Convert the tags from entries to a map.
		instance.Tags = instance.Tags.reduce((tags, tag) => {
			tags[tag.Key] = tag.Value;

			return tags;
		}, {});
	} catch (e) {
		console.log(`[!] Failed to retrieve instance details. ${e}`);
		return callback("Failed to retrieve instance details");
	}

	let user, campaignId;
	
	try {
		const spotFleetRequestId = instance.Tags['aws:ec2spot:fleet-request-id'];
		if (!spotFleetRequestId) {
			console.log(`[!] Instance tag 'aws:ec2spot:fleet-request-id' is missing. Got tags: ${JSON.stringify(instance.Tags)}`);
			return callback("aws:ec2spot:fleet-request-id tag is missing");
		}

		console.log(`[+] Querying Campaigns GSI for spotFleetRequestId: ${spotFleetRequestId}`);

		const ddb = new aws.DynamoDB({ region: settings.region });

		const campaignQuery = await ddb.query({
			TableName: "Campaigns",
			IndexName: "SpotFleetRequests",
			KeyConditionExpression: "spotFleetRequestId = :sfr",
			ExpressionAttributeValues: {
				":sfr": { S: spotFleetRequestId }
			}
		}).promise();

		if (!campaignQuery.Items || campaignQuery.Items.length === 0) {
			console.log(`[!] No campaign found for SpotFleetRequestId: ${spotFleetRequestId}`);
			return callback("No campaign found for SpotFleetRequestId");
		}

		const campaignItem = campaignQuery.Items[0];
		user = campaignItem.userid.S;
		const campaignKey = campaignItem.keyid.S;
		campaignId = campaignKey.split(':')[1];

		// Update that campaign details
		await ddb.updateItem({
			Key: {
				userid: { S: user },
				keyid: { S: campaignKey }
			},
			TableName: "Campaigns",
			AttributeUpdates: {
				interrupted: {
					Action: "PUT",
					Value: { S: "Spot Interruption" }
				}
			}
		}).promise();
	} catch (e) {
		console.log(`[!] Failed to mark instance as interrupted. ${e}`);
		return callback("Failed to mark instance as interrupted");
	}

	console.log(`[+] Marked campaign ${campaignId} as interrupted.`);
}