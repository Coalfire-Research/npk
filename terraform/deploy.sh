#! /bin/bash

echo "***********************************************************"
echo " Hello friend! Thanks for using NPK!"
echo
echo " Need help, want to contribute, or want to brag about a win?"
echo " Join us on Discord! [ https://discord.gg/k5PQnqSNDF ]"
echo 
echo " Sincerely, @c6fc"
echo "***********************************************************"
echo
echo

if [[ $1 == "" ]]; then
	TERBIN=terraform
else
	TERBIN=$1
fi

ERR=0;
if [[ ! -f $(which jsonnet) ]]; then
	ERR=1;
	echo "Error: Must have 'jsonnet' command installed.";
fi

if [[ ! -f $(which jq) ]]; then
	ERR=1;
	echo "Error: Must have 'jq' command installed.";
fi

if [[ ! -f $(which aws) ]]; then
	ERR=1;
	echo "Error: Must have AWSCLI installed.";
fi

if [[ $(aws --version | grep -c "aws-cli/2") != 1 ]]; then
	ERR=1;
	echo "Error: Wrong version of Terraform is installed. NPK requires AWSCLI version 2.";
fi

if [[ ! -f $(which npm) ]]; then
	ERR=1;
	echo "Error: Must have NPM installed.";
fi

if [[ ! -f $(which terraform) ]]; then
	ERR=1;
	echo "Error: Must have Terraform installed.";
fi

if [[ $($TERBIN -v | grep -c "Terraform v0.15") != 1 ]]; then
	ERR=1;
	echo "Error: Wrong version of Terraform is installed. NPK requires Terraform v0.15.";
	echo "-> Note: A non-default binary can be specified as a positional script parameter:"
	echo "-> e.g: ./deploy.sh <terraform-v0.15-path>"
	echo ""
fi

if [[ -f $(which snap) ]]; then
	if [[ $(snap list | grep $TERBIN | wc -l) -ne 0 ]]; then
		ERR=1;
		echo "Error: Terraform cannot be installed via snap. Download the v0.15 binary manually and place it in your path."
	fi

	if [[ $(snap list | grep jsonnet | wc -l) -ne 0 ]]; then
		ERR=1;
		echo "Error: jsonnet cannot be installed via snap. Download the binary manually and place it in your path."
	fi

	if [[ $(snap list | grep jq | wc -l) -ne 0 ]]; then
		ERR=1;
		echo "Error: jq cannot be installed via snap. Install via apt or download in manually and place it in your path."
	fi
fi

if [[ "$ERR" == "1" ]]; then
	echo -e "\nInstall missing components, then try again.\n"
	exit 1
fi

## Check for v2 config, and exit if found.
if [[ $(jq -r 'select(has("useCustomDNS")) | length' npk-settings.json) -gt 0 ]]; then
	ERR=1
fi

if [[ $(jq -r 'select(has("useSAML")) | length' npk-settings.json) -gt 0 ]]; then
	ERR=1
fi

if [[ $(jq -r 'select(has("dnsNames")) | length' npk-settings.json) -gt 0 ]]; then
	ERR=1
fi

if [[ "$ERR" == "1" ]]; then
	echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
	echo "NPKv2.5 has different settings from v2, and is NOT capable of a direct upgrade."
	echo "If you're upgrading from v2, you need to 'terraform destroy' the existing environment"
	echo "using Terraform 0.11. After that, update npk-settings.json and redeploy using Terraform 0.15."
	echo
	echo "The safest way to proceed is to destroy everything, pull v2.5 to a new folder, and deploy from scratch."
	echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
	echo
	exit 1
fi

PROFILE=$(jq -r '.awsProfile' npk-settings.json)

export AWS_DEFAULT_REGION=us-west-2
export AWS_DEFAULT_OUTPUT=json
export AWS_PROFILE=$PROFILE

# Disable Pager for AWS CLI v2
if [[ $(aws --version | grep "aws-cli/2" | wc -l) -ge 1 ]]; then
	export AWS_PAGER="";
fi

BUCKET=$(jq -r '.backend_bucket' npk-settings.json)

if [[ "$BUCKET" == "" ]]; then
	echo "No backend bucket is specified in npk-settings.json. This is best practice and required for NPKv2."
	echo "If you specify a bucket that doesn't exist, NPK will create it for you. How easy is that?"
	echo "Update npk-settings.json and try again."
	echo ""
	exit 1
fi

EXISTS=$(aws s3api get-bucket-location --bucket $BUCKET)
if [[ $? -ne 0 ]]; then
	aws s3api create-bucket --bucket $BUCKET --create-bucket-configuration LocationConstraint=$AWS_DEFAULT_REGION

	if [[ $? -ne 0 ]]; then
		echo "Error creating backend_bucket. Fix that^ error then try again."
		exit 1
	fi
else
	if [[ "$( echo $EXISTS | jq -r '.LocationConstraint' )" != "$AWS_DEFAULT_REGION" ]]; then
		echo "The backend_bucket you specified doesn't reside in the defaultRegion. Specify a bucket in us-west-2, then try again."
		echo "$( echo $EXISTS | jq '.LocationConstraint' ) vs. $AWS_DEFAULT_REGION"
		exit 1
	fi
fi

echo "[*] Preparing to deploy NPK."

ZONE=$(jq -r 'select(has("route53Zone")) | .route53Zone' npk-settings.json)

if [[ $ZONE != "" ]]; then
	echo "[*] Getting Route53 Hosted Zone FQDN..."
	ZONEFQDN=$(aws route53 get-hosted-zone --id $ZONE | jq -r '.HostedZone.Name')

	# Chop off the trailing '.';
	ZONEFQDN=${ZONEFQDN:0:-1}

	if [[ $? -ne 0 ]]; then
		echo "[-] Unable to retrieve Route53 Hosted Zone with ID [ $ZONE ]."
		exit 1
	fi

	echo "[+] -> Using DNS Base Name of [ $ZONEFQDN ]"

	jq -n --arg ZONEFQDN "$ZONEFQDN" '{ dnsBaseName: $ZONEFQDN }' > hostedZone.json
else
	echo "{}" > hostedZone.json
fi

if [[ ! -f quotas.json ]]; then

	echo "[*] Checking account quotas..."

	PQUOTA=$(aws service-quotas list-service-quotas --service-code ec2 | jq '.Quotas[] | select(.QuotaCode == "L-7212CCBC") | .Value')
	GQUOTA=$(aws service-quotas list-service-quotas --service-code ec2 | jq '.Quotas[] | select(.QuotaCode == "L-3819A6DF") | .Value')

	if [[ $PQUOTA -eq 0 ]]; then
		PQUOTA=384
	fi

	if [[ $GQUOTA -eq 0 ]]; then
		GQUOTA=384
	fi

	QUOTAERR=0
	if [[ $PQUOTA -lt 16 ]]; then
		QUOTAERR=1
		echo "The target account is limited to fewer than 384 vCPUs in us-west-2 for P-type instances."
		echo "-> Current limit: $PQUOTA"
		echo ""
	fi

	if [[ $GQUOTA -lt 16 ]]; then
		QUOTAERR=1
		echo "The target account is limited to fewer than 16 vCPUs in us-west-2 for G-type instances."
		echo "-> Current limit: $GQUOTA"
		echo ""
	fi

	if [[ $QUOTAERR -eq 1 ]]; then
		echo "You cannot proceed without increasing your limits."
		echo "-> A limit of at least 16 is required for minimal capacity."
		echo "-> A limit of 384 is required for full capacity."
		echo ""
		exit 1
	fi

	QUOTAWARN=0
	if [[ $PQUOTA -lt 384 ]]; then
		QUOTAWARN=1
		echo "The target account is limited to fewer than 384 vCPUs in us-west-2 for P-type instances."
		echo "-> Current limit: $PQUOTA"
		echo ""
	fi

	if [[ $GQUOTA -lt 384 ]]; then
		QUOTAWARN=1
		echo "The target account is limited to fewer than 384 vCPUs in us-west-2 for G-type instances."
		echo "-> Current limit: $GQUOTA"
		echo ""
	fi

	if [[ $QUOTAWARN -eq 1 ]]; then
		echo "1. Attempting to create campaigns in excess of these limits will fail".
		echo "2. The UI will not prevent you from requesting campaigns in excess of these limits."
		echo "3. The UI does not yet indicate when requests fail due to exceeded limits."
		echo ""
		echo "tl;dr: You can ignore this warning, but probably don't."
		echo ""
		read -r -p " Do you understand? [Yes]: " key

		if [[ "$key" != "Yes" ]]; then
			echo "You must accept the campaign size warning with 'Yes' in order to continue."
			echo ""

			exit 1
		fi

		jq -n --arg PQUOTA "$PQUOTA" --arg GQUOTA "$GQUOTA" '{pquota: $PQUOTA, gquota: $GQUOTA}' > quotas.json
	fi
else
	echo "[*] Using known quotas. Delete quotas.json to force re-evaluation."
fi

# Get the availability zones for each region
if [ ! -f regions.json ]; then
	echo "[*] Getting availability zones from AWS"
	while IFS= read -r region; do
		echo "[*] - ${region}"
		aws ec2 --region ${region} describe-availability-zones | jq -r '{"'${region}'": [.AvailabilityZones[] | select(.State=="available") | .ZoneName]}' > region-${region}.json
	done <<< $(echo '["us-east-1", "us-east-2", "us-west-1", "us-west-2"]' | jq -r '.[]')

	jq -rs 'reduce .[] as $item ({}; . * $item)' ./region-*.json > regions.json
	rm region-*.json

	if [[ "$(cat regions.json | wc -l)" -lt "4" ]]; then
		echo -e "\n[!] Error retrieving AWS availability zones. Check the 'awsProfile' setting and try again"
		rm regions.json
		exit 1
	fi
else
	echo "[*] Using known availability zones. Delete regions.json to force re-evaluation."
fi

if [[ ! -d .terraform ]]; then
	echo "[+] Creating service-linked roles for EC2 spot fleets"
	
	# check if roles already exist
	SPOTROLE=$(aws iam list-roles | jq '.Roles[] | select(.RoleName == "AWSServiceRoleForEC2Spot") | .RoleName')
	FLEETROLE=$(aws iam list-roles | jq '.Roles[] | select(.RoleName == "AWSServiceRoleForEC2SpotFleet") | .RoleName')
	if [ -r $SPOTROLE ]; then 
		aws iam create-service-linked-role --aws-service-name spot.amazonaws.com
	else
		echo "[*] AWSServiceRoleForEC2Spot already exists"
	fi
	if [ -r $FLEETROLE ]; then 
		aws iam create-service-linked-role --aws-service-name spotfleet.amazonaws.com
	else 
		echo "[*] AWSServiceRoleForEC2SpotFleet already exists"
	fi
fi

# remove old configs silently:
rm -f *.tf.json

echo "[*] Generating Terraform configurations"
jsonnet -m . terraform.jsonnet

if [[ "$?" -eq "1" ]]; then
	echo ""
	echo "[!] An error occurred generating the config files. Address the error and try again."
	echo ""
	exit 1
fi

aws s3api head-object --bucket $BUCKET --key c6fc.io/npk2.5/terraform.tfstate 2&> /dev/null
ISINIT="$?"

if [[ ! -d .terraform || $ISINIT -ne 0 ]]; then
	$TERBIN init -force-copy

	if [[ $? -ne 0 ]]; then
		echo "[-] An error occurred while running 'terraform init'. Address the error and try again"
		exit 1
	fi
fi

$TERBIN apply -auto-approve

if [[ $? -eq 0 ]]; then
	echo
	echo "[+] Deployment complete. You're ready to go!"
else
	echo
	echo "[!] Deployment failed. If you're having trouble, hop in Discord for help."
	exit 1
fi

# Setting file ownership to the user that cloned the repo.
OUID=`ls -n deploy.sh | cut -d" " -f3`
chown -R ${OUID}:${OUID} *