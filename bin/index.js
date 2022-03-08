'use strict';

const fs = require("fs");
const yargs = require("yargs");
const readline = require("readline");

const { exec } = require("child_process");
const { Sonnet } = require("@c6fc/sonnetry");
const { Jsonnet } = require("@hanazuki/node-jsonnet");

const sonnetry = new Sonnet({
	renderPath: './render-npk',
	cleanBeforeRender: true
});


async function deploy(skipInit, autoApprove) {

	let settings;
	const aws = sonnetry.aws;

	try {
		settings = JSON.parse(fs.readFileSync('./npk-settings.json'));
	} catch (e) {
		console.log(e);
		console.log("\n[!] Unable to open npk-settings.json. Does it exist?");
		return false;
	}

	const validatedSettings = {};

	// Check for invalid settings
	const allowedSettings = [
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

	// Determine the route53 zone information.
	if (!!settings.route53Zone) {
		const route53 = new aws.Route53();
		let zone;

		try {
			zone = await route53.getHostedZone({
				Id: settings.route53Zone
			}).promise();

			validatedSettings.dnsBaseName = zone.HostedZone.Name.slice(0, -1)

			console.log("[+] Validated route53Zone");

		} catch(e) {
			console.log(`[!] Unable to retrieve hosted zone. ${e}`);
			return false;
		}
	}

	// Generate region list. AZ's are done later to only capture those with appropriate quotas.
	const ec2 = new aws.EC2({ region: "us-east-1" });
	let regions;

	try {
		regions = await ec2.describeRegions().promise();

		regions = regions.Regions
			.filter(r => ["opt-in-not-required", "opted-in"].indexOf(r.OptInStatus) > -1)
			.map(r => r.RegionName);

	} catch (e) {
		console.log(`[!] Unable to retrieve region list. ${e}`);
		return false;
	}

	validatedSettings.providerRegions = regions;

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

	validatedSettings.quotas = regionQuotas;
	
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

	validatedSettings.regions = azs;

	console.log("[+] Retrieved availability zones.");

	const iam = new aws.IAM();

	try {
		await iam.getRole({
			RoleName: "AWSServiceRoleForEC2Spot"
		}).promise();
	} catch (e) {
		console.log(`[*] EC2 spot SLR is not present. Creating...`);

		try {
			await iam.createServiceLinkedRole({
				AWSServiceName: "spot.amazonaws.com"
			}).promise();
		} catch (e) {
			console.trace(e);
			console.log(`[!] Unable to create service linked role: ${e}`);
		}
	}

	console.log("\n[*] All prerequisites finished. Generating infrastructure configurations.");

	sonnetry.export('validatedSettings', validatedSettings);

	try {
		await sonnetry.render('terraform.jsonnet');
	} catch (e) {
		console.trace(e);
		console.log(`\n[!] Failed to generate NPK configurations.`);
		return false;
	}

	sonnetry.write();

	console.log(`[+] Configurations updated successfully. Preparing to deploy.`);

	try {
		sonnetry.apply(skipInit, autoApprove);
	} catch (e) {
		console.trace(e);
		console.log('\n[!] Failed to apply configuration.')
		return false;
	}

	console.log("[+] NPK successfully deployed. Happy hunting.");

	return true;
}

async function configureInteractive() {

	const aws = sonnetry.aws;
	const inquirer = require('inquirer');

	let settings = {};
	if (fs.existsSync('npk-settings.json')) {
		settings = JSON.parse(fs.readFileSync('npk-settings.json'));
		console.log("[*] Loading existing settings.");
	}

	const ec2 = new aws.EC2();
	let regions = await ec2.describeRegions().promise()

	regions = regions.Regions
		.filter(e => e.OptInStatus != "not-opted-in")
		.map(e => e.RegionName)

	const route53 = new aws.Route53();
	let hostedZones = await route53.listHostedZones({
		MaxItems: "10"
	}).promise();

	if (hostedZones.HostedZones.isTruncated) {
		console.log("[!] You have too many Route53 Hosted Zones for interactive configurations. Sorry.");
		return false
	}

	hostedZones = hostedZones.HostedZones.map(e => Object.create({
		name: e.Name,
		value: e.Id.split('/')[2]
	}));
	hostedZones.unshift(new inquirer.Separator());
	hostedZones.unshift({
		name: "- None -",
		value: null
	});

	const questions = [{
			type: 'list',
			name: 'route53Zone',
			message: 'Use custom domain?',
			choices: hostedZones,
			default: settings.route53Zone ?? "- None -"
		}, {
			type: 'list',
			name: 'primaryRegion',
			message: 'Which region do you plan to use most?',
			choices: regions,
			default: settings.primaryRegion ?? "us-west-2"
		}, {
			type: 'input',
			name: 'adminEmail',
			message: 'What is the admin user\'s email address?',
			default: settings.adminEmail ?? ""
		}, {
			type: 'input',
			name: 'criticalEventsSMS',
			message: 'Enter an SMS-enabled phone number for critical events, including country code:',
			default: settings.criticalEventsSMS ?? "+",
			filter(value) {
				if (value.match("^\d*$")) {
					return "+" + value;
				}

				return value
			}
		}, {
			type: 'input',
			name: 'campaign_max_price',
			message: 'Max campaign price in USD:',
			default: 50,
			filter(value) {
				return value / 1;
			}
		}, {
			type: 'confirm',
			name: 'deploy',
			message: 'NPK is configured. Deploy now?',
			default: true
		}];

	// Remove the Route53 question if there are no zones.
	if (hostedZones.length == 2) {
		questions.shift();
	}

	await drainStdin(0);

	const answers = await inquirer.prompt(questions);

	const deployNow = answers.deploy;
	delete answers.deploy;

	fs.writeFileSync('npk-settings.json', JSON.stringify(Object.assign(settings, answers), null, '\t'));

	if (!deployNow) {
		console.log("[-] Exiting on user command. Use 'npm run deploy' to deploy");
		process.exit(0);
	}
}

function drainStdin(duration) {
	return new Promise((success, failure) => {
		const onData = function() {};
		const onEnd = function() {
			process.stdin.removeListener('data', onData);
			process.stdin.removeListener('end', onEnd);
			return success();
		};

		process.stdin.on('data', onData);
		process.stdin.on('end', onEnd);

		setTimeout(onEnd, duration);
	});
}

function showHelloBanner() {
	console.log("***********************************************************");
	console.log(" Hello friend! Thanks for using NPK!");
	console.log("");
	console.log(" Need help, want to contribute, or want to brag about a win?");
	console.log(" Join us on Discord! [ https://discord.gg/k5PQnqSNDF ]");
	console.log("");
	console.log(" Sincerely, @c6fc");
	console.log("***********************************************************");
	console.log("");
}

function showHelpBanner() {
	console.log("[!] Deployment failed. If you're having trouble, hop in Discord for help.");
	console.log("--> Porchetta Industries Discord: https://discord.gg/k5PQnqSNDF");
	console.log("");
	process.exit(1);
}

(async () => {

	yargs
		.usage("Syntax: $0 <command> [options]")
		.command("*", "Invalid command", (yargs) => {
			yargs
		}, (argv) => {
			console.log("[~] Invalid command.");
		})
		.command("deploy", "Deploys NPK", (yargs) => {
			return yargs.option('interactive', {
				alias: 'i',
				type: 'boolean',
				description: 'Configure NPK interactively before deployment.'
			}).option('skipInit', {
				alias: 's',
				type: 'boolean',
				description: 'Skip the Terraform Init phase. Useful for development.'
			}).option('autoApprove', {
				alias: 'y',
				type: 'boolean',
				description: 'Auto-approve Terraform changes. Useful for development.'
			});
		}, async (argv) => {

			showHelloBanner();

			if (fs.existsSync('./npk-settings.json')) {
				const settings = JSON.parse(fs.readFileSync('./npk-settings.json'));
				if (!!settings.awsProfile && process.env.AWS_PROFILE != settings.awsProfile) {
					process.env.AWS_PROFILE = settings.awsProfile;
					console.log("[+] You were about to deploy to the wrong profile. I've corrected it for you.");
				}
			}

			await sonnetry.auth();

			const s3 = new sonnetry.aws.S3();
			let bootstrap_bucket = await sonnetry.getBootstrapBucket();

			if (!!bootstrap_bucket) {
				try {
					const settings = await s3.getObject({
						Bucket: bootstrap_bucket,
						Key: 'sonnetry/c6fc_npk/npk-settings.json'
					}).promise();

					fs.writeFileSync(settings, './npk-settings.json');

					console.log('[+] Retrieved npk-settings.json from Sonnetry');
				} catch (e) {
					// That's fine.
				}
			}

			if (argv.interactive || !fs.existsSync('./npk-settings.json')) {
				await configureInteractive();
			}

			const success = await deploy(argv.skipInit, argv.autoApprove);

			bootstrap_bucket = await sonnetry.getBootstrapBucket();
			const settings = await fs.readFileSync('./npk-settings.json');

			await s3.putObject({
				Bucket: bootstrap_bucket,
				Key: 'sonnetry/c6fc_npk/npk-settings.json',
				Body: settings,
				ContentType: 'application/json'
			}).promise();

			console.log('\n[+] NPK settings saved to Sonnetry');

			if (!success) showHelpBanner();

		})
		.command("destroy", "Removes NPK and destroys all resources", (yargs) => {
			return yargs.option('interactive', {
				alias: 'i',
				type: 'boolean',
				description: 'Configure NPK interactively before deployment.'
			}).option('skipInit', {
				alias: 's',
				type: 'boolean',
				description: 'Skip the Terraform Init phase. Useful for development.'
			}).option('autoApprove', {
				alias: 'y',
				type: 'boolean',
				description: 'Auto-approve Terraform changes. Useful for development.'
			});
		}, async (argv) => {

			showHelloBanner();

			if (fs.existsSync('./npk-settings.json')) {
				const settings = JSON.parse(fs.readFileSync('./npk-settings.json'));
				if (!!settings.awsProfile) {
					process.env.AWS_PROFILE = settings.awsProfile;
					delete process.env.AWS_ACCESS_KEY_ID;
					delete process.env.AWS_SECRET_ACCESS_KEY;
					delete process.env.AWS_SESSION_TOKEN;
				}
			}

			await sonnetry.auth();

			if (argv.interactive || !fs.existsSync('./npk-settings.json')) {
				await configureInteractive();
			}

			const success = await deploy(argv.skipInit, argv.autoApprove);
			if (!success) showHelpBanner();

		})
		.showHelpOnFail(false)
		.help("help")
		.argv;
})();