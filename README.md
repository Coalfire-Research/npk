# NPK - Increase your cred yield!

NPK is a distributed hash-cracking platform built entirely of serverless components in AWS including Cognito, DynamoDB, and S3. It was designed for easy deployment and the intuitive UI brings high-power hash-cracking to everyone.

![Image](/readme-content/dashboard-active.png)

'NPK' is an initialism for the three primary atomic elements in fertilizer (Nitrogen, Phosphorus, and Potassium). Add it to your hashes to increase your cred yield!

## How it works

Lets face it - even the beastliest cracking rig spends a lot of time at idle. You sink a ton of money up front on hardware, then have the electricity bill to deal with. NPK lets you leverage extremely powerful hash cracking with the 'pay-as-you-go' benefits of AWS. For example, you can crank out as much as 1.2TH/s of NTLM for a mere $14.70/hr. NPK was also designed to fit easily within the free tier while you're not using it! Without the free tier, it'll still cost less than 25 CENTS per MONTH to have online!

If you'd like to see it in action, check out the video here: https://www.youtube.com/watch?v=BrBPOhxkgzc

## Features

### 1. Super easy install

One config file, one command to run. That's about it. To start off, copy the `terraform/npk-settings.json.example` file to `terraform/npk-settings.json`, then modify the settings as necessary:



Once the file is saved, just run `./deploy.sh` from within the `npk/terraform/` folder.

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

## Install

NPK requires that you have the following installed: 
* **awscli** (v2)
* **terraform** (v0.11)
* **jq**
* **jsonnet**
* **npm**

**ProTip:** To keep things clean and distinct from other things you may have in AWS, it's STRONGLY recommended that you deploy NPK in a fresh account. You can create a new account easily from the 'Organizations' console in AWS. **By 'STRONGLY recommended', I mean 'seriously don't install this next to other stuff'.**

```sh
$ git clone npk .
$ cd npk/terraform/
npk/terraform$ cp npk-settings.json.sample npk-settings.json
```

Edit `npk-settings.json` to taste:

`backend_bucket`: Is the bucket to store the terraform state in. If it doesn't exist, NPK will create it for you. Replace '<somerandomcharacters>' with random characters to make it unique, or specify another bucket you own.
`campaign_data_ttl`: This is the number of seconds that uploaded files and cracked hashes will last before they are automatically deleted. Default is 7 days.
`campaign_max_price`: The maximum number of dollars allowed to be spent on a single campaign.
`georestrictions`: An array of https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2 country codes that access should be WHITELISTED for. Traffic originating from other countries will not be permitted.
`useCustomDNS`: A boolean value for whether to use custom domain names for your NPK installation. if set to `true`, you must configure `route53Zone` and `dnsNames` below.
`route53Zone`: The Route53 Zone ID for the domain or subdomain you're going to host NPK with. You must configure this zone yourself in the same account before installing NPK.
`dnsNames`: This is where you configure the DNS names for the console and api endpoints for your NPK installation. Both domains must be at the same depth as one another; e.g. {www,api}.npk.yourdomain.com
`awsProfile`: The profile name in `~/.aws/credentials` that you want to piggyback on for the installation.
`criticalEventsSMS`: The cellphone number of a destination to receive critical events to. Only catastrophic errors are reported here, so use a real one.
`adminEmail`: The email address of the administrator and first user of NPK. Once the installation is complete, this is where you'll receive your credentials.
`useSAML`: Set to `true` if you want to enable SAML-based federated authentication.
`sAMLMetadataFile` or `sAMLMetadataUrl`: Only one can be configured, and it's required if `useSAML` is `true`.

Here's an example of a completed config file with custom DNS and no SAML:

```json
{
  "backend_bucket": "backend-terraform-npkdev",
  "campaign_data_ttl": 604800,
  "campaign_max_price": 50,
  "georestrictions": [],
  "useCustomDNS": true,
  "route53Zone": "Z05471496OWNC3E2EHCI",
  "dnsNames": {
    "www": [
      "www.npk.yourdomain.com"
    ],
    "api": [
      "api.npk.yourdomain.com"
    ]
  },
  "awsProfile": "npkdev",
  "criticalEventsSMS": "+12085551234",
  "adminEmail": "you@yourdomain.com",
  "debug_lambda": true,

  "useSAML": false,
  "sAMLMetadataFile": ""
}
```
After that, run the deploy!

```sh
npk/terraform$ ./deploy.sh
```

For more details about each setting, their effects, and allowed values, check out [the wiki](https://github.com/Coalfire-Research/npk/wiki/Detailed-NPK-Settings). For more details around custom installations, see [Detailed Instructions](https://github.com/Coalfire-Research/npk/wiki/Detailed-Usage-Instructions).

NPK will use the specified AWS cli profile to fully deploy NPK and provision the first user. If you'd like to change the configuration, simply run `./deploy.sh` again afterward. While it's deploying, pay a visit to https://aws.amazon.com/marketplace/pp/B07S5G9S1Z to subscribe and accept the terms of NVidia's AMIs. NPK uses these to ensure compatability with the GPUs. There is no cost associated with this step, but allows NPK to use these AMIs on your behalf.

Once it's done, you'll receive an email with the URL and credentials to your deployment:

![Image](/readme-content/npk-invite.png)

**NOTE: CloudFront may take several minutes to come up after the deployment is done. This is normal. Grab yourself a cup of coffee after the deploy and give the cloud a few minutes to do its magic.**

## Modify Install

You can change the settings of an install without losing your existing campaigns. Edit `npk-settings.json` as necessary, then rerun `deploy.sh`. That easy!

```sh
npk/terraform$ vim npk-settings.json
npk/terraform$ ./deploy.sh
```

## Uninstall

You can completely turn down NPK and delete all of its data from AWS with a single command:

```sh
npk/terraform$ terraform destroy
```

