'use strict';

const fs = require('fs');
const aws = require('aws-sdk');
const zlib = require('zlib');
const util = require('util');
const stream = require('stream');

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
	const key = event.s3.object.key;

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

	let newKey = `${type}/${basename}.gz`;

	if (!['rules', 'wordlist'].includes(type)) {
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

	const raw = s3.getObject({
		Bucket: bucket,
		Key: key
	}).createReadStream();

	let size = 0;
	let lines = 0;
	const lineCounter = new stream.Transform({
		transform(chunk, encoding, callback) {
			size += chunk.length;
			lines += (Buffer.from(chunk, encoding).toString().match(/\n/g) || []).length;
			callback(null, chunk)
		}
	});

	const gzip = zlib.createGzip();
	const { writeStream, s3Promise } = uploadStream(bucket, newKey, s3);

	await pipe(raw, lineCounter, gzip, writeStream).catch(e => {
		return callback(e);
	});

	await s3Promise;

	console.log(size, lines);

	await s3.deleteObject({
		Bucket: bucket,
		Key: key
	}).promise();

	if (size == 0 || lines == 0) {
		await s3.deleteObject({
			Bucket: bucket,
			Key: newKey
		}).promise();

		return callback(`[!] File has no linebreaks or a length of 0. Removing it.`);
	}

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


	const used = process.memoryUsage().heapUsed / 1024 / 1024;
	console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);
	
	return callback(null, 'Done.');
}