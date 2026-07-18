'use strict';

const fs = require('fs');
const aws = require('aws-sdk');
const zlib = require('zlib');
const util = require('util');
const stream = require('stream');

const accountDetails = JSON.parse(fs.readFileSync('./accountDetails.json', 'ascii'));

const variables = JSON.parse(JSON.stringify(process.env));
variables.subnets = JSON.parse(variables.subnets);

const pipe = util.promisify(stream.pipeline);

function uploadStream(Bucket, Key, s3) {

	const passthrough = new stream.PassThrough();

	return {
		writeStream: passthrough,
		s3Promise: s3.upload({ Bucket, Key, Body: passthrough }).promise()
	}
}

exports.main = async function(event, context, callback) {
	console.log(JSON.stringify(event));

	event = event.Records?.[0];

	if (!event) {
		return callback('[!] Invalid event received.');
	}

	const s3 = new aws.S3({ region: event.awsRegion });
	const bucket = event.s3.bucket.name;
	const keysize = event.s3.object.size;
	const key = event.s3.object.key;

	if (keysize > 1500 * Math.pow(1024, 3)) {
		console.log("[!] Max file size is 2.5TiB.");
		return false;
	}

	// Get the filename. #sorrynotsorry.
	const basename = key
		.split('/')
		.pop()
		.split('.')
		.slice(0, -1)
		.join('.')
		.toString();

	const type = key
		.split('/')
		.slice(-2, -1)
		.toString();

	const extension = key
		.split('.')
		.slice(-1)[0];

	let newKey = `${type}/${basename}.gz`;

	if (!['rules', 'wordlist'].includes(type)) {
		await s3.deleteObject({
			Bucket: bucket,
			Key: key
		}).promise();

		return callback(`[!] '${type}' is not a valid type.`);
	}

	// Append a timestamp if the file already exists.
	try {
		const exists = await s3.headObject({
			Bucket: bucket,
			Key: newKey
		}).promise();

		newKey = `${type}/${basename}-${Date.now()}.gz`
	} catch (e) {
		// all good.
	}

	// Use EC2 for compression if the size is over 4GB:
	if (keysize > 4 * Math.pow(1024, 3)) {
		const sq = new aws.ServiceQuotas({ region: event.awsRegion });
		const ec2 = new aws.EC2({ region: event.awsRegion });

		let instanceType = "i3en.2xlarge";
		const i3Quota = await sq.getServiceQuota({
			ServiceCode: 'ec2',
			QuotaCode: 'L-34B43A08'
		}).promise()

		// console.log(i3Quota.Quota);

		if (i3Quota.Quota.Value < 4) {
			console.log("[!] Insufficient quota.");
			return false;
		}

		if (i3Quota.Quota.Value < 8) {
			if (keysize > 1500 * Math.pow(1024, 3)) {
				console.log("[!] Your limited quota limits your max file size to 1.5TiB.");
				return false;
			}

			console.log("[-] Using smaller instance due to quota limitations.");
			instanceType = "i3en.2xlarge";
		}

		// Build a launchSpecification for each AZ in the target region.
		const instance_userdata = new Buffer.from(fs.readFileSync(__dirname + '/userdata.sh', 'utf-8')
			.replace("{{targetfile}}", `s3://${bucket}/${key}`)
			.replace("{{targetfiletype}}", type)
			.replace("{{dictionarybucket}}", variables.dictionaryBucket))
			.toString('base64');

		const images = await ec2.describeImages({
			Filters: [{
				Name: "virtualization-type",
				Values: ["hvm"]
			}, {
				Name: "root-device-type",
				Values: ["ebs"]
			}, {
				Name: "architecture",
				Values: ["x86_64"]
			}, {
				Name: "owner-id",
				Values: ["137112412989"]
			}, {
				Name: "name",
				Values: ["al2023-ami-2023.*"]
			}]
		}).promise()

		const image = images.Images.reduce((newest, entry) => 
			entry.CreationDate > newest.CreationDate ? entry : newest
		, { CreationDate: '1980-01-01T00:00:00.000Z' });

		console.log(images);

		if (!!!image.ImageId) {
			console.log("Unable to find a suitable AMI.");
			return false;
		}

		const launchSpecificationTemplate = {
            ImageId: image.ImageId,
			KeyName: "npk-key",
			InstanceType: instanceType,
            NetworkInterfaces: [{
				DeviceIndex: 0,
				DeleteOnTermination: true,
				AssociatePublicIpAddress: true
			}],
            IamInstanceProfile: {
				Arn: variables.compressionProfile
			},
            TagSpecifications: [{
				ResourceType: "instance",
				Tags: [{
					Key: "TargetFile",
					Value: newKey
				}]
			}],
            UserData: instance_userdata
        }

		// Create a copy of the launchSpecificationTemplate for each AvailabilityZone in the campaign's region.
		const launchSpecifications = Object.keys(variables.subnets).reduce((specs, entry) => {
			const az = JSON.parse(JSON.stringify(launchSpecificationTemplate)); // Have to deep-copy to avoid referential overrides.

			az.NetworkInterfaces[0].SubnetId = variables.subnets[entry];

			return specs.concat(az);
		}, []);

		const spotFleetParams = {
			SpotFleetRequestConfig: {
				AllocationStrategy: "lowestPrice",
				IamFleetRole: variables.iamFleetRole,
				InstanceInterruptionBehavior: "terminate",
				LaunchSpecifications: launchSpecifications,
				SpotPrice: "0.90",
				TargetCapacity: 1,
				ReplaceUnhealthyInstances: false,
				TerminateInstancesWithExpiration: true,
				Type: "request",
				ValidFrom: (new Date().getTime() / 1000),
				ValidUntil: (new Date().getTime() / 1000) + (4 * 3600)
			}
		};

		const sfr = await ec2.requestSpotFleet(spotFleetParams).promise();

		console.log(`[+] Successfully requested Spot fleet [ ${sfr.SpotFleetRequestId} ]`);

		return true;
	}

	const raw = s3.getObject({
		Bucket: bucket,
		Key: key
	}).createReadStream();

	let size = 0;
	let lines = 0;
	let time = Date.now();
	const lineCounter = new stream.Transform({
		transform(chunk, encoding, callback) {
			if (size == 0) {
				console.log(`[*] TTFT: ${(Date.now() - time)}ms`);
				time = Date.now();
			}

			size += chunk.length;
			lines += (Buffer.from(chunk, encoding).toString().match(/\n/g) || []).length;
			callback(null, chunk)
		}
	});

	console.log(`[*] Found extension [${extension}]`);

	if (extension == "gz") {
		console.log(`[*] Treating as gzip`);

		const gunzip = zlib.createGunzip();
		const devnull = fs.createWriteStream('/dev/null');

		await pipe(raw, gunzip, lineCounter, devnull).catch(async e => {
			await s3.deleteObject({
				Bucket: bucket,
				Key: key
			}).promise();
			
			return callback(e);
		});

		const lapsed = (Date.now() - time) / 1000;
		console.log(`[*] Stream unzipped ${Math.round(size / 1024)}KB in ${lapsed} seconds; ${Math.round(size / lapsed / 1024)}KB/s`);

		console.log(lapsed, size, size / lapsed, lines);

		await s3.copyObject({
			Bucket: bucket,
			CopySource: `/${bucket}/${key}`,
			Key: newKey,
			Metadata: { 
				type,
				lines: lines.toString(),
				size: size.toString()
			},
			MetadataDirective: 'REPLACE'
		}).promise();

	} else {

		const gzip = zlib.createGzip();
		const { writeStream, s3Promise } = uploadStream(bucket, newKey, s3);

		await pipe(raw, lineCounter, gzip, writeStream).catch(async e => {
			await s3.deleteObject({
				Bucket: bucket,
				Key: key
			}).promise();

			return callback(e);
		});

		await s3Promise;

		const lapsed = (Date.now() - time) / 1000;
		console.log(`[*] Stream zipped ${Math.round(size / 1024)}KB in ${lapsed} seconds; ${Math.round(size / lapsed / 1024)}KB/s`);

		console.log(lapsed, size, size / lapsed, lines);

		await s3.copyObject({
			Bucket: bucket,
			CopySource: `/${bucket}/${newKey}`,
			Key: newKey,
			Metadata: { 
				type,
				lines: lines.toString(),
				size: size.toString()
			},
			MetadataDirective: 'REPLACE'
		}).promise();

		if (size == 0 || lines == 0) {
			await s3.deleteObject({
				Bucket: bucket,
				Key: newKey
			}).promise();

			return callback(`[!] File has no linebreaks or a length of 0. Removing it.`);
		}
	}

	await s3.deleteObject({
		Bucket: bucket,
		Key: key
	}).promise();

	const used = process.memoryUsage().heapUsed / 1024 / 1024;
	console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);
	
	return callback(null, 'Done.');
}
