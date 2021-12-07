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
		// Pull the campaign from the ManifestPath tag
		if (!instance.Tags?.ManifestPath || instance.Tags.ManifestPath.indexOf('/campaigns/') < 0) {
			console.log(`[!] Instance tag 'ManifestPath' is invalid. Got tags: ${JSON.stringify(instance.Tags)}`);
			return callback("Instance tag 'ManifestPath' is invalid");
		}

		[user, campaignId] = instance.Tags.ManifestPath.split('/campaigns/');

		// Update that campaign details
		const ddb = new aws.DynamoDB({ region: settings.region });

		await ddb.updateItem({
			Key: {
				userid: { S: user },
				keyid: { S: `campaigns:${campaignId}` }
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