#! /bin/bash

echo "**"
echo
echo ">> The deploy-selfhost.sh script is deprecated. Please use 'npm run selfhost' instead."
echo
echo "**"

exit 1

export AWS_DEFAULT_REGION=$(jq -r '.primaryRegion' ../terraform/npk-settings.json)
export AWS_DEFAULT_OUTPUT=json
export AWS_PROFILE=$(jq -r '.awsProfile' ../terraform/npk-settings.json)

# Disable Pager for AWS CLI v2
if [[ $(aws --version | grep "aws-cli/2" | wc -l) -ge 1 ]]; then
	export AWS_PAGER="";
fi

BUCKET=$(jq -r '.backend_bucket' ../terraform/npk-settings.json)

aws head-object --bucket $BUCKET --key "c6fc.io/npk3/terraform.tfstate" 2> /dev/null

if [[ $? -ne 0 ]]; then
	echo "[!] You must deploy NPK with community configurations first. Go to the 'terraform' folder and run 'npm run deploy'";
	exit 1
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

aws s3api head-object --bucket $BUCKET --key c6fc.io/npkv3/terraform-selfhost.tfstate 2&> /dev/null
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

OUID=`ls -n deploy-selfhost.sh | cut -d" " -f3`
chown -R ${OUID}:${OUID} *

cd ../terraform/
./deploy.sh $TERBIN