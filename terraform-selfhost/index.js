'use strict';

const fs = require("fs");
const aws = require("aws-sdk");
const readline = require("readline");
const { exec } = require("child_process");
const { Jsonnet } = require("@hanazuki/node-jsonnet");

async function generate() {
	
	let settings;

	try {
		settings = JSON.parse(fs.readFileSync('../terraform/npk-settings.json'));
	} catch (e) {
		console.log(e);
		console.log("\n[!] Unable to open npk-settings.json. Does it exist?");
		return false;
	}

	let useCache = true;

	try {

		const cache = JSON.parse(fs.readFileSync('../terraform/.terraform/profile_cache.json'));

		if (cache.profile != settings.awsProfile || cache.expired) {
			console.log("[!] Cached role is expired. Will attempt to renew.");
			useCache = false;
		} else {
			console.log("[+] Attempting to use cached role.");
			aws.config.update(cache);

			let err = await aws.config.credentials.getPromise();

			if (!!err) {
				console.log(2, err);
				return false;
			}

			const sts = new aws.STS();
			const caller = await sts.getCallerIdentity().promise();

			console.log(`[+] Successfully resumed session for ${caller.Arn}`);
		}

	} catch (e) {
		useCache = false;
	}

	if (!useCache) {
		const creds = await new Promise((success, failure) => {
		
			let waitForToken = false;

			const temp = new aws.SharedIniFileCredentials({
				profile: settings.awsProfile,
				tokenCodeFn: (mfaSerial, callback) => {
					waitForToken = true;

					const rl = readline.createInterface({
						input: process.stdin,
						output: process.stdout
					});

					rl.question(`Enter MFA code for ${mfaSerial}: `, function(token) {
						rl.close();

						success(temp);
						callback(null, token);
					});
				}
			});

			if (!waitForToken) {
				success(temp);
			}
		});

		let err = await creds.getPromise();

		if (!!err) {
			console.log(err);
			return false;
		}

		aws.config.update({
			credentials: creds
		});

		try {
			const sts = new aws.STS();
			const caller = await sts.getCallerIdentity().promise();
		} catch (e) {
			console.log("[!] Unable to load AWS Profile.");
			return false;
		}

		fs.writeFileSync('../terraform/.terraform/profile_cache.json', JSON.stringify({
			accessKeyId: creds.accessKeyId,
			secretAccessKey: creds.secretAccessKey,
			sessionToken: creds.sessionToken,
			profile: creds.profile
		}), { mode: '600' });
	}

	fs.writeFileSync('../terraform/.ENVVARS', 
		`export AWS_ACCESS_KEY_ID=${aws.config.credentials.accessKeyId}\n` +
		`export AWS_SECRET_ACCESS_KEY=${aws.config.credentials.secretAccessKey}\n` +
		`export AWS_SESSION_TOKEN=${aws.config.credentials.sessionToken ?? ''}`,
		{ mode: '600' }
	);

	process.env.AWS_ACCESS_KEY_ID = aws.config.credentials.accessKeyId;
	process.env.AWS_SECRET_ACCESS_KEY = aws.config.credentials.secretAccessKey;
	process.env.AWS_SESSION_TOKEN = aws.config.credentials.sessionToken ?? '';

	// Determine backend_bucket location, or create it if it doesn't exist.
	const s3 = await new aws.S3({ region: "us-east-1" });

	let backendBucket;

	try {
		backendBucket = await s3.getBucketLocation({
			Bucket: settings.backend_bucket
		}).promise();
	} catch (e) {

		// If the bucket doesn't exist, create it.
		if (e.toString().indexOf("NotFound") === 0) {
			console.log(`[*] Creating backend bucket ${settings.backend_bucket}`);

			try {

				const params = {
					Bucket: settings.backend_bucket
				};

				if (settings.region != "us-east-1") {
					params.LocationConstraint = settings.region
				};

				const createBucket = await s3.createBucket(params).promise();

				backendBucket = await s3.getBucketLocation({
					Bucket: settings.backend_bucket
				}).promise();
			} catch (e) {
				console.log(`[!] Unable to create backendBucket. ${e}`);
				return false;
			}
		} else {
			console.log("[!] Unable to proceed. Fix this error then try again.");
		}
	}

	backendBucket.LocationConstraint = (backendBucket.LocationConstraint == '') ? "us-east-1" : backendBucket.LocationConstraint;

	console.log("[+] Validated backend_bucket");

	try {
		let s3 = new aws.S3({ region: backendBucket.locationConstraint });
		s3.headObject({
			Bucket: settings.backend_bucket,
			Key: "c6fc.io/npk3/terraform.tfstate"
		}).promise();

	} catch (e) {

		if (e.toString().indexOf("NotFound") === 0) {
			console.log(`[!] You must first deploy the community version before running selfhost. Go to the 'terraform' folder and run 'npm run deploy'`);
			return false;
		} else {
			console.log(`[!] Unable to verify Terraform state. ${e}`);
			return false;
		}
	}

	console.log("[+] Community state is OK");

	await updateIndex();

	// Remove tf.json files.parse
	try {
		let regex = /.*?\.tf\.json$/
		fs.readdirSync('./')
			.filter(f => regex.test(f))
			.map(f => fs.unlinkSync('./' + f));

	} catch (e) {
		console.log('[!] Failed to remove *.tf.json files. ${e}');
		return false;
	}

	// Produce Terraform files with JSonnet.
	console.log("\n[*] All prerequisites finished. Generating infrastructure configurations.");

	try {
		const jsonnet = new Jsonnet();
		const sonnetry = await jsonnet.evaluateFileMulti('./terraform-selfhost.jsonnet');

		Object.keys(sonnetry).forEach((file) => {
			fs.writeFileSync('./' + file, sonnetry[file]);
		});

	} catch (e) {
		console.log(`[!] JSonnet failed to produce Terraform artifacts. ${e}`);
		return false;
	}

	console.log(`[+] Configurations updated successfully.`);

	return true;
}

function showHelpBanner() {
	console.log("[!] Selfhost deployment failed. If you're having trouble, hop in Discord for help.");
	console.log("--> Porchetta Industries Discord: https://discord.gg/k5PQnqSNDF");
	process.exit(1);
}

async function updateIndex() {
	try {
		const { stderr, stdout } = await exec("git update-index --assume-unchanged ../terraform/dictionaries.auto.tfvars");
		console.log("[+] Updated git index.");

	} catch (e) {
		console.log(`[!] Unable to update git index: ${e}`);
		return false;
	}

	return true;
}

(async () => {
	const success = await generate();
	if (!success) showHelpBanner();
})();