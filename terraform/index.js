'use strict';

// process.env.AWS_SDK_LOAD_CONFIG = 1;

const fs = require("fs");
const aws = require("aws-sdk");
const readline = require("readline");
const { Jsonnet } = require("@hanazuki/node-jsonnet");

(async () => {
	
	let useCache = true;
	let settings

	try {
		settings = JSON.parse(fs.readFileSync('npk-settings.json'));
	} catch (e) {
		console.log(e);
		console.log("\n[!] Unable to open npk-settings.json. Does it exist?");
	}

	try {

		const cache = JSON.parse(fs.readFileSync('.terraform/profile_cache.json'));

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

		fs.writeFileSync('.terraform/profile_cache.json', JSON.stringify({
			accessKeyId: creds.accessKeyId,
			secretAccessKey: creds.secretAccessKey,
			sessionToken: creds.sessionToken,
			profile: creds.profile
		}));
	}

	process.env.AWS_ACCESS_KEY_ID = aws.config.credentials.accessKeyId;
	process.env.AWS_SECRET_ACCESS_KEY = aws.config.credentials.secretAccessKey;
	process.env.AWS_SESSION_TOKEN = aws.config.credentials.sessionToken;

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

	// Determine the route53 zone information.
	if (!!settings.route53Zone) {
		const route53 = new aws.Route53();
		let zone;

		try {
			zone = await route53.getHostedZone({
				Id: settings.route53Zone
			}).promise();

			fs.writeFileSync('hostedZone.json', JSON.stringify({
				dnsBaseName: zone.HostedZone.Name.slice(0, -1)
			}));

		} catch(e) {
			console.log(`[!] Unable to retrieve hosted zone. ${e}`);
			return false;
		}
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

		/*regions = regions.Regions.reduce((regionList, region) => {
			if (["opt-in-not-required", "opted-in"].indexOf(region.OptInStatus) > -1) {
				regionList.push(region.RegionName);
			}

			return regionList;
		}, []);*/
	} catch (e) {
		console.log(`[!] Unable to retrieve region list. ${e}`);
		return false;
	}

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

			/*data.Quotas = data.Quotas.forEach((quota) => {
				if (quotaCodes.indexOf(quota.QuotaCode) > -1 && quota.Value > 0) {
					if (!regionQuotas[region]) {
						regionQuotas[region] = {};
					};

					regionQuotas[region][quota.QuotaCode] = quota.Value;
					maxQuota = (quota.Value > maxQuota) ? quota.Value : maxQuota;
				}
			});*/
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

	fs.writeFileSync('quotas.json', JSON.stringify(regionQuotas, null, 2));
	
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

		/*promises.push(ec2.describeAvailabilityZones().promise().then((data) => {
			data.AvailabilityZones.forEach((availabilityZone) => {
				if (availabilityZone.State == "available") {
					azs[region].push(availabilityZone.ZoneName);
				}
			});
		}));*/

		return promises;
	}, []);

	await Promise.all(azPromises);

	fs.writeFileSync('regions.json', JSON.stringify(azs, null, 2));

	console.log("[+] Retrieved availability zones.");

	// Remove tf.json files.parse
	try {
		let regex = /.*?\.tf\.json$/
		fs.readdirSync('.')
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
		const sonnetry = await jsonnet.evaluateFileMulti('terraform.jsonnet');

		Object.keys(sonnetry).forEach((file) => {
			fs.writeFileSync(file, sonnetry[file]);
		});

	} catch (e) {
		console.log(`[!] JSonnet failed to produce Terraform artifacts. ${e}`);
		return false;
	}

	try {
		let s3 = new aws.S3({ region: backendBucket.locationConstraint });
		s3.headObject({
			Bucket: settings.backend_bucket,
			Key: "c6fc.io/npk3/terraform.tfstate"
		}).promise();

		console.log(`[+] Configurations updated successfully. Use 'npm run deploy' to deploy.`);

	} catch (e) {
		if (e.toString().indexOf("NotFound") === 0) {
			console.log(`[+] Configurations generated successfully. Use 'npm run init && npm run deploy' to deploy.`);
		} else {
			console.log(`[!] Unable to verify Terraform state. ${e}`);
			return false;
		}
	}

})() || process.exit(1);
