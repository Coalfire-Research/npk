#! /bin/bash

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

if [[ ! -f $(which npm) ]]; then
	ERR=1;
	echo "Error: Must have NPM installed.";
fi

if [[ ! -f $(which terraform) ]]; then
	ERR=1;
	echo "Error: Must have Terraform installed.";
fi

if [[ "$(terraform -v | grep v0.11 | wc -l)" != "1" ]]; then
	ERR=1;
	echo "Error: Wrong version of Terraform is installed. NPK requires Terraform v0.11.";
fi

if [[ ! -f $(which snap) ]]; then
	if [[ $(snap list | grep $TERBIN | wc -l) ]]; then
		ERR=1;
		echo "Error: Terraform cannot be installed via snap. Download the v0.11 binary manually and place it in your path."
	fi

	if [[ $(snap list | grep jsonnet | wc -l) ]]; then
		ERR=1;
		echo "Error: jsonnet cannot be installed via snap. Download the binary manually and place it in your path."
	fi

	if [[ $(snap list | grep jq | wc -l) ]]; then
		ERR=1;
		echo "Error: jq cannot be installed via snap. Install via apt or download in manually and place it in your path."
	fi
fi

if [[ "$ERR" == "1" ]]; then
	echo -e "\nInstall missing components, then try again.\n"
	exit 1
fi

PROFILE=$(jq -r '.awsProfile' npk-settings.json)

export AWS_DEFAULT_REGION=us-west-2
export AWS_DEFAULT_OUTPUT=json
export AWS_PROFILE=$PROFILE

echo "[*] Checking account quotas..."

PQUOTA=$(aws service-quotas list-service-quotas --service-code ec2 | jq '.Quotas[] | select(.QuotaCode == "L-7212CCBC") | .Value')
GQUOTA=$(aws service-quotas list-service-quotas --service-code ec2 | jq '.Quotas[] | select(.QuotaCode == "L-3819A6DF") | .Value')

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

if [[ $QUOTAWARN -eq 1 ]]; then
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
		echo "You must accept the campaign size warning in order to continue."
		echo ""

		exit 1
	fi
fi


echo "[*] Preparing to deploy NPK."

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
	aws iam create-service-linked-role --aws-service-name spot.amazonaws.com
	aws iam create-service-linked-role --aws-service-name spotfleet.amazonaws.com
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

if [[ ! -d .terraform ]]; then
	$TERBIN init
fi

terraform apply -auto-approve
terraform apply -auto-approve	# Yes, userdata.sh is an unresolvable cyclical dependency. I am ashamed.