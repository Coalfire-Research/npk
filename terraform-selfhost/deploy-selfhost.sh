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

if [[ $(aws --version | grep -c "aws-cli/2") != 1 ]]; then
	ERR=1;
	echo "Error: Wrong version of AWSCLI is installed. NPK requires AWSCLI version 2.";
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
	echo "-> e.g: ./deploy-selfhost.sh <terraform-v0.15-path>"
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

PROFILE=$(jq -r '.awsProfile' ../terraform/npk-settings.json)

export AWS_DEFAULT_REGION=us-west-2
export AWS_DEFAULT_OUTPUT=json
export AWS_PROFILE=$PROFILE

# Disable Pager for AWS CLI v2
if [[ $(aws --version | grep "aws-cli/2" | wc -l) -ge 1 ]]; then
	export AWS_PAGER="";
fi

BUCKET=$(jq -r '.backend_bucket' ../terraform/npk-settings.json)

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

# Get the availability zones for each region
if [ ! -f ../terraform/regions.json ]; then
	echo "[*] Getting availability zones from AWS"
	while IFS= read -r region; do
		echo "[*] - ${region}"
		aws ec2 --region ${region} describe-availability-zones | jq -r '{"'${region}'": [.AvailabilityZones[] | select(.State=="available") | .ZoneName]}' > region-${region}.json
	done <<< $(echo '["us-east-1", "us-east-2", "us-west-1", "us-west-2"]' | jq -r '.[]')

	jq -rs 'reduce .[] as $item ({}; . * $item)' ./region-*.json > ../terraform/regions.json
	rm region-*.json

	if [[ "$(cat ../terraform/regions.json | wc -l)" -lt "4" ]]; then
		echo -e "\n[!] Error retrieving AWS availability zones. Check the 'awsProfile' setting and try again"
		rm ../terraform/regions.json
		exit 1
	fi
else
	echo "[*] Using known availability zones. Delete regions.json to force re-evaluation."
fi

# remove old configs silently:
rm -f *.tf.json

echo "[*] Generating Terraform configurations"
jsonnet -m . terraform-selfhost.jsonnet

if [[ "$?" -eq "1" ]]; then
	echo ""
	echo "[!] An error occurred generating the config files. Address the error and try again."
	echo ""
	exit 1
fi

aws s3api head-object --bucket $BUCKET --key c6fc.io/npkv2.5/terraform-selfhost.tfstate 2&> /dev/null
ISINIT="$?"

if [[ ! -d .terraform || $ISINIT -ne 0 ]]; then
	$TERBIN init -force-copy

	if [[ $? -ne 0 ]]; then
		echo "[-] An error occurred while running 'terraform init'. Address the error and try again"
		exit 1
	fi
fi

$TERBIN apply -auto-approve

if [[ "$?" -eq "1" ]]; then
	echo ""
	echo "[!] An error occurred while running terraform for selhost. Address the error and try again."
	echo ""
	exit 1
fi

echo "[*] Marking custom components as assume-unchanged in git."
git update-index --assume-unchanged ../terraform/dictionaries.auto.tfvars ../site-content/assets/js/dictionary-buckets.js

echo "[*] Selfhost deployment complete. Running NPK primary deployment to capture the changes."
echo
echo

cd ../terraform/
./deploy.sh $TERBIN