# NPK - Increase your cred yield!

NPK is a distributed hash-cracking platform built entirely of serverless components in AWS including Cognito, DynamoDB, and S3. It was designed for easy deployment and the intuitive UI brings high-power hash-cracking to everyone.

![Image](/readme-content/dashboard-active.png)

'NPK' is an initialism for the three primary atomic elements in fertilizer (Nitrogen, Phosphorus, and Potassium). Add it to your hashes to increase your cred yield!

## Upgrading from v2.5

NPK v3 is now easier than ever to deploy, with both Terraform and JSonnet dependencies handled automatically. It now supports all AWS regions and all GPU-powered instance families. The old Bash script deployment method has been depricated in favor of a Node.js-based deployment utility, which makes deployments more consistent across platforms.

NPK v3 is directly-upgradable from v2.5, which means you don't need to destroy your existing deployment. Just pull the new version, and run a deploy with NPM:

```sh
npk/terraform$ git pull
npk/terraform$ npm run deploy
```

**Important note: Cost change from v2.5 to v3:** NPK has historically used an S3 bucket in each region to eliminate data transfer costs between a bucket in one region and cracking nodes in another. While this duplicated the data to be stored, it meant that per-campaign transfer costs were lower. With the newfound inclusion of non-US regions, this design wasn't scalable, and NPK now uses a single bucket in your `primaryRegion`. This means that storage costs are lower, but large dictionaries and rules files will incur a $0.02/GB transfer fee to compute nodes outside your `primaryRegion`. As a result, it's a good idea to stick to campaigns in your `primaryRegion` when you can. This also means that the monthly cost of hosting NPK has risen to roughly $1.50.

**Important note: Automatic Self-Hosting**
NPK now configures self-hosted buckets by default, and copies the dictionaries and rules files from the community buckets during installation. Specifying a `primaryRegion` other than "us-west-2" will incur cross-region data transfer charges of \~$0.70 to populate your bucket.

## How it works

Let's face it - even the beastliest cracking rig spends a lot of time at idle. You sink a ton of money up front on hardware, then have the electricity bill to deal with. NPK lets you leverage extremely powerful hash cracking with the 'pay-as-you-go' benefits of AWS. For example, you can crank out as much as 1.2TH/s of NTLM for a mere $14.70/hr. NPK was also designed to fit easily within the free tier while you're not using it! Without the free tier, it'll still cost less than $2 per MONTH to have online!

If you'd like to see it in action, check out the video here: https://www.youtube.com/watch?v=BrBPOhxkgzc

## Features

### 1. Super easy install

Build the Docker container and run the wizard. That's about it.

### 2. Intuitive campaign builder

Take the trial-and-error out of complex attack types with the intuitive campaign builder. With a couple clicks you can create advanced campaigns that even advanced Hashcat users would struggle to emulate.

### 3. Campaign price and coverage estimates

Take the guess-work out of your campaigns. See how far you'll get and how much it will cost *before* starting the campaign.

![Image](/readme-content/coverage.png)

### 4. Max price enforcement and runaway instance protection

GPU instances are expensive. Runaway GPU instances are EXTREMELY expensive. NPK will enforce a maximum campaign price limit, and was designed to prevent runaway instances even with a complete failure of the management plane.

### 5. Multi-Tenancy & SAML-based single sign-on

NPK supports multiple users, with strict separation of data, campaigns, and results between each user. It can optionally integrate with SAML-based federated identity providers to enable large teams to use NPK with minimal effort.

![Image](/readme-content/userManagement.png)

### 6. Data lifecycle management

Configure how long data will stay in NPK with configurable lifecycle durations during installation. Hashfiles and results are automatically removed after this much time to keep things nicely cleaned up.

## Easy Install (Docker)

```sh
$ git clone https://github.com/c6fc/npk
$ cd npk
npk$ ./build-docker-container.sh
... Docker builds and runs.
you:~/npk/terraform$ ./quickdeploy.sh
```

The quickdeploy wizard will ask for a few basic things, then kick off the install on your behalf.

## Advanced Install

### Clone the Repo

```sh
$ git clone https://github.com/c6fc/npk
$ cd npk/terraform/
npk/terraform$ cp npk-settings.json.sample npk-settings.json
```

### Install the Prerequisites (or use Docker)

NPK requires that you have the following installed: 
* **awscli** (v2)
* **cmake**
* **nvm**

You can skip these prerequisites by using the provided Docker image.
```sh
npk$ ./build-docker-container.sh
you:~/npk/terraform$ 
```

### Edit the settings file

**ProTip:** To keep things clean and distinct from other things you may have in AWS, it's STRONGLY recommended that you deploy NPK in a fresh account. You can create a new account easily from the 'Organizations' console in AWS. **By 'STRONGLY recommended', I mean 'seriously don't install this next to other stuff'.**

Edit `npk-settings.json` to taste:

**Required settings**
* `backend_bucket`: Is the bucket to store the terraform state in. If it doesn't exist, NPK will create it for you. Replace '<somerandomcharacters>' with random characters to make it unique, or specify another bucket you own.
* `criticalEventsSMS`: The cellphone number of a destination to receive critical events to. Only catastrophic errors are reported here, so use a real one.
* `adminEmail`: The email address of the administrator and first user of NPK. Once the installation is complete, this is where you'll receive your credentials.

**Optional settings**
* `awsProfile`: The profile name in `~/.aws/credentials` that you want to piggyback on for the installation. **Defaults to `"default"`**.
* `primaryRegion`: If you have a preferred region to deploy the management plane into, put it here. Note that some components will always be deployed into us-east-1, regardless of what this value is set to. **Defaults to `"us-west-2"`**.
* `campaign_data_ttl`: This is the number of seconds that uploaded files and cracked hashes will last before they are automatically deleted. **Defaults to `86400` or 7 days**.
* `campaign_max_price`: The maximum number of dollars allowed to be spent on a single campaign.**Defaults to `50`**.
* `georestrictions`: An array of https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2 country codes that access should be WHITELISTED for. Traffic originating from other countries will not be permitted. Remove the entry entirely if you don't wish to use it. **Defaults to `[]`**.
* `route53Zone`: The Route53 Zone ID for the domain or subdomain you're going to host NPK with. You must configure this zone yourself in the same account before installing NPK. *The NPK console will be hosted at the root of this zone* with the API endpoint being created as a subdomain.**Ignored by default**.
* `sAMLMetadataFile` or `sAMLMetadataUrl`: Only one can be configured. Leave them out entirely if you're not using SAML.

Here's an example of a bare-minimum config file with a non-default AWS Profile:

```json
{
  "backend_bucket": "backend-terraform-npkdev-wocspztcr",
  "awsProfile": "npkdev",
  "criticalEventsSMS": "+12085551234",
  "adminEmail": "you@yourdomain.com",
}
```

For comparison, here's an advanced config deployed to eu-west-2 with $100 campaign limit, two week data TTL, custom DNS, Okta-based SAML SSO, and accessible only to Germany

```json
{
  "backend_bucket": "backend-terraform-npkdev-wocspztcr",
  "awsProfile": "npkdev",
  "campaign_data_ttl": 1209600,
  "campaign_max_price": 100,
  "georestrictions": ["DE"],
  "primaryRegion": "ue-west-2",
  "route53Zone": "Z0123456789",
  "criticalEventsSMS": "+12085551234",
  "adminEmail": "you@yourdomain.com",
  "sAMLMetadataUrl": "https://dev-xxxxxxxx.okta.com/app/exampleau4LOLCATCAFE/sso/saml/metadata"
}
```
After that, run the deploy!

```sh
npk/terraform$ npm run deploy
```

For more details about each setting, their effects, and allowed values, check out [the wiki](https://github.com/c6fc/npk/wiki/Detailed-NPK-Settings). For more details around custom installations, see [Detailed Instructions](https://github.com/c6fc/npk/wiki/Detailed-Usage-Instructions).

NPK will use the specified AWS cli profile to fully deploy NPK and provision the first user. If you'd like to change the configuration, simply run `npm run deploy` again afterward. Once it's done, you'll receive an email with the URL and credentials to your deployment:

![Image](/readme-content/npk-invite.png)

**NOTE: CloudFront may take several minutes to come up after the deployment is done. This is normal. Grab yourself a cup of coffee after the deploy and give the cloud a few minutes to do its magic.**

## Modify Install

You can change the settings of an install without losing your existing campaigns. Edit `npk-settings.json` as necessary, then rerun `npm run deploy`. That easy!

```sh
npk/terraform$ vim npk-settings.json
npk/terraform$ npm run deploy
```

## Uploading your own dictionaries and rule files

Once NPK has been deployed, you can upload your own wordlists and rules files using the `upload_npkfile.sh` script in the `tools` directory. Note that these scripts are generated by Terraform, and don't exist until the deployment is complete:

```sh
npk/tools$ upload_npkfile.sh wordlist RockYou.txt
npk/tools$ upload_npkfile.sh rules OneRuleToRuleThemAll.txt
```

## Uninstall

You can completely turn down NPK and delete all of its data from AWS with a single command:

```sh
npk/terraform$ npm run destroy
```

# Official Discord Channel

Have questions, need help, want to contribute or brag about a win? Come hang out on Discord!

[![Porchetta Industries](https://discordapp.com/api/guilds/736724457258745996/widget.png?style=banner3)](https://discord.gg/k5PQnqSNDF)