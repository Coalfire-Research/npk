'use strict';

const fs = require("fs");
const aws = require("aws-sdk");
const readline = require("readline");
const { exec } = require("child_process");
const { Jsonnet } = require("@hanazuki/node-jsonnet");

async function generate() {

	console.log("***********************************************************");
	console.log(" Hello friend! Thanks for using NPK!");
	console.log("");
	console.log(" Need help, want to contribute, or want to brag about a win?");
	console.log(" Join us on Discord! [ https://discord.gg/k5PQnqSNDF ]");
	console.log("");
	console.log(" Sincerely, @c6fc");
	console.log("***********************************************************");
	console.log("");

	let settings;

	try {
		settings = JSON.parse(fs.readFileSync('./npk-settings.json'));
	} catch (e) {
		console.log(e);
		console.log("\n[!] Unable to open npk-settings.json. Does it exist?");
		return false;
	}

	let useCache = true;

	try {

		if (fs.existsSync('./.terraform/profile_cache.json')) {
			const cache = JSON.parse(fs.readFileSync('./.terraform/profile_cache.json'));

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
		} else {
			useCache = false;
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

		if (!fs.existsSync('./.terraform/')) {
			fs.mkdirSync('./.terraform/');
		}

		fs.writeFileSync('./.terraform/profile_cache.json', JSON.stringify({
			accessKeyId: creds.accessKeyId,
			secretAccessKey: creds.secretAccessKey,
			sessionToken: creds.sessionToken,
			profile: creds.profile
		}), { mode: '600' });
	}

	fs.writeFileSync('./.ENVVARS', 
		`export AWS_ACCESS_KEY_ID=${aws.config.credentials.accessKeyId}\n` +
		`export AWS_SECRET_ACCESS_KEY=${aws.config.credentials.secretAccessKey}\n` +
		`export AWS_SESSION_TOKEN=${aws.config.credentials.sessionToken ?? ''}`,
		{ mode: '600' }
	);

	process.env.AWS_ACCESS_KEY_ID = aws.config.credentials.accessKeyId;
	process.env.AWS_SECRET_ACCESS_KEY = aws.config.credentials.secretAccessKey;
	process.env.AWS_SESSION_TOKEN = aws.config.credentials.sessionToken ?? '';

	// Check for old config elements that aren't compatible with 2.5+
	const hasOldConfig = ['useCustomDNS', 'useSAML', 'dnsNames'].reduce((oldConfig, e) => {
		oldConfig = (settings.hasOwnProperty[e]) ? true : oldConfig;
		return oldConfig;
	}, false);

	if (hasOldConfig) {
		console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
		console.log("NPKv2.5+ has different settings from previous versions, and is NOT capable of a direct upgrade.");
		console.log("If you're upgrading from v2, you need to 'terraform destroy' the existing environment");
		console.log("using Terraform 0.11. After that, update npk-settings.json and redeploy using Terraform 0.15.");
		console.log("The safest way to proceed is to destroy everything, pull v2.5 to a new folder, and deploy from scratch.");
		console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
		return false;
	}

	// Check for invalid settings
	const allowedSettings = [
		'backend_bucket',
		'campaign_data_ttl',
		'campaign_max_price',
		'georestrictions',
		'route53Zone',
		'awsProfile',
		'criticalEventsSMS',
		'adminEmail',
		'sAMLMetadataFile',
		'sAMLMetadataUrl',
		'primaryRegion'
	];

	const badSettings = Object.keys(settings)
		.filter(e => allowedSettings.indexOf(e) < 0)
		.map(e => console.log(`[!] Invalid setting key [${e}] in npk-settings.json`));

	if (badSettings.length > 0) {
		console.log('[!] Fix your settings, then try again.');
		return false;
	}


	// Determine backend_bucket location, or create it if it doesn't exist.
	const s3 = await new aws.S3({ region: "us-east-1" });

	let backendBucket;

	try {
		backendBucket = await s3.getBucketLocation({
			Bucket: settings.backend_bucket
		}).promise();
	} catch (e) {

		// If the bucket doesn't exist, create it.
		if (e.toString().indexOf("NoSuchBucket") === 0) {
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

	// Determine the route53 zone information.
	if (!!settings.route53Zone) {
		const route53 = new aws.Route53();
		let zone;

		try {
			zone = await route53.getHostedZone({
				Id: settings.route53Zone
			}).promise();

			fs.writeFileSync('./hostedZone.json', JSON.stringify({
				dnsBaseName: zone.HostedZone.Name.slice(0, -1)
			}));

		} catch(e) {
			console.log(`[!] Unable to retrieve hosted zone. ${e}`);
			return false;
		}
	} else {
		fs.writeFileSync('./hostedZone.json', "{}");
	}

	console.log("[+] Validated route53Zone");

	// Generate region list. AZ's are done later to only capture those with appropriate quotas.
	const ec2 = new aws.EC2({ region: "us-east-1" });
	let regions;

	try {
		regions = await ec2.describeRegions().promise()

		regions = regions.Regions
			.filter(r => ["opt-in-not-required", "opted-in"].indexOf(r.OptInStatus) > -1)
			.map(r => r.RegionName);

	} catch (e) {
		console.log(`[!] Unable to retrieve region list. ${e}`);
		return false;
	}

	fs.writeFileSync('./providerRegions.json', JSON.stringify(regions));

	console.log("[+] Retrieved all active regions");

	// Check quotas for all regions.
	const families = JSON.parse(fs.readFileSync('./jsonnet/gpu_instance_families.json'));

	const quotaCodes = Object.keys(families).reduce((codes, family) => {
		const code = families[family].quotaCode;

		if (codes.indexOf(code) == -1) {
			codes.push(code);
		}

		return codes;
	}, []);

	let maxQuota = 0;
	const regionQuotas = {};
	const quotaPromises = regions.reduce((quotas, region) => {
		const sq = new aws.ServiceQuotas({ region });

		quotas.push(sq.listServiceQuotas({
			ServiceCode: 'ec2'
		}).promise().then((data) => {

			data.Quotas
				.filter(q => quotaCodes.indexOf(q.QuotaCode) > -1 && q.Value > 0)
				.map(q => {
					regionQuotas[region] ??= {};

					regionQuotas[region][q.QuotaCode] = q.Value;
					maxQuota = (q.Value > maxQuota) ? q.Value : maxQuota;
				});
		}));

		return quotas;
	}, []);

	await Promise.all(quotaPromises);

	if (maxQuota == 0) {
		console.log("[!] You are permitted zero GPU spot instances across all types and regions.");
		console.log("You cannot proceed without increasing your limits.");
		console.log("-> A limit of at least 4 is required for minimal capacity.");
		console.log("-> A limit of 40 is required to use the largest instances.");

		return false;
	}

	fs.writeFileSync('./quotas.json', JSON.stringify(regionQuotas, null, 2));
	
	console.log("[+] Retrieved quotas.");

	// Retrieve availability zones for regions with appropriate quotas.
	const azs = {};
	const azPromises = Object.keys(regionQuotas).reduce((promises, region) => {
		const ec2 = new aws.EC2({ region });

		azs[region] = [];

		promises.push(ec2.describeAvailabilityZones().promise().then((data) => {
			data.AvailabilityZones
				.filter(a => a.State == "available")
				.map(a => azs[region].push(a.ZoneName));
		}));

		return promises;
	}, []);

	await Promise.all(azPromises);

	fs.writeFileSync('./regions.json', JSON.stringify(azs, null, 2));

	console.log("[+] Retrieved availability zones.");

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
		const sonnetry = await jsonnet.evaluateFileMulti('./terraform.jsonnet');

		Object.keys(sonnetry).forEach((file) => {
			fs.writeFileSync('./' + file, sonnetry[file]);
		});

	} catch (e) {
		console.log(`[!] JSonnet failed to produce Terraform artifacts. ${e}`);
		return false;
	}

	// Force update the backend bucket region.
	try {
		const backend = JSON.parse(fs.readFileSync('backend.tf.json'));

		backend.terraform.backend.s3.region = backendBucket.LocationConstraint;

		fs.writeFileSync('backend.tf.json', JSON.stringify(backend));
	}  catch (e) {
		console.log(`[!] Failed to update backend_bucket region. ${e}`);
		return false;
	}

	console.log(`[+] Configurations updated successfully. Use 'npm run deploy' to deploy.`);

	return true;
}

function showHelpBanner() {
	console.log("[!] Deployment failed. If you're having trouble, hop in Discord for help.");
	console.log("--> Porchetta Industries Discord: https://discord.gg/k5PQnqSNDF");
	console.log("");
	process.exit(1);
}

(async () => {
	const success = await generate();
	if (!success) showHelpBanner();
})();