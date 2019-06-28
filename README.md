# NPK - Increase your cred yield!

NPK is a distributed hash-cracking platform built entirely of serverless components in AWS including Cognito, DynamoDB, and S3. It was designed for easy deployment and the intuitive UI brings high-power hash-cracking to everyone.

![Image](/readme-content/dashboard-active.png)

'NPK' is an initialism for the three primary atomic elements in fertilizer (Nitrogen, Phosphorus, and Potassium). Add it to your hashes to increase your cred yield!

## How it works

Lets face it - even the beastliest cracking rig spends a lot of time at idle. You sink a ton of money up front on hardware, then have the electricity bill to deal with. NPK lets you leverage extremely powerful hash cracking with the 'pay-as-you-go' benefits of AWS. For example, you can crank out as much as 1.2TH/s of NTLM for a mere $14.70/hr. NPK was also designed to fit easily within the free tier while you're not using it! Without the free tier, it'll still cost less than 25 CENTS per MONTH to have online!

If you'd like to see it in action, check out the video here: https://www.youtube.com/watch?v=BrBPOhxkgzc

## Features

### 1. Super easy install

One config file, one command to run. That's about it.

### 2. Intuitive campaign builder

Take the trial-and-error out of complex attack types with the intuitive campaign builder. With a couple clicks you can create advanced campaigns that even advanced Hashcat users would struggle to emulate.

### 3. Campaign price and coverage estimates

Take the guess-work out of your campaigns. See how far you'll get and how much it will cost *before* starting the campaign.

![Image](/readme-content/coverage.png)

### 4. Max price enforcement and runaway instance protection

GPU instances are expensive. Runaway GPU instances are EXTREMELY expensive. NPK will enforce a maximum campaign price limit, and was designed to prevent runaway instances even with a complete failure of the management plane.

### 5. Multi-Tenancy

NPK supports multiple users, with strict separation of data, campaigns, and results between each user.

### 6. Data lifecycle management

Configure how long data will stay in NPK with configurable lifecycle durations during installation. Hashfiles and results are automatically removed after this much time to keep things nicely cleaned up.

## Install

NPK requires that you have the following installed: 
* **awscli** (> v1.16)
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

Edit `npk-settings.json` to taste. Most importantly, ensure that the 'awsProfile' value matches the profile name in `~/.aws/credentials`:

```sh
[profileName]
aws_access_key_id = ...
aws_secret_access_key = ...
```

```sh
npk/terraform$ ./deploy.sh
```

NPK will use the specified AWS cli profile to fully deploy NPK and provision the first user. If you'd like to change the configuration, simply run `./deploy.sh` again afterward. While it's deploying, pay a visit to https://aws.amazon.com/marketplace/pp?sku=5rwcw3y2wbhixiw6qoi1gwdxt to subscribe and accept the terms of NVidia's AMIs. NPK uses these to ensure compatability with the GPUs. There is no cost associated with this step, but allows NPK to use these AMIs on your behalf.

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

