#! /bin/bash

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

if [[ "$ERR" == "1" ]]; then
	echo -e "\nInstall missing components, then try again.\n"
	exit 1
fi

echo "[*] Preparing to deploy NPK."
echo "[*] Getting availabilityzones from AWS"
# Get the availability zones for each region
echo "[*] - us-east-1"
aws --profile $(jq -r '.awsProfile' npk-settings.json) ec2 --region us-east-1 describe-availability-zones | jq '{"us-east-1": [.AvailabilityZones[] | select(.State=="available") | .ZoneName]}' > r1.json
echo "[*] - us-east-2"
aws --profile $(jq -r '.awsProfile' npk-settings.json) ec2 --region us-east-2 describe-availability-zones | jq '{"us-east-2": [.AvailabilityZones[] | select(.State=="available") | .ZoneName]}' > r2.json
echo "[*] - us-west-1"
aws --profile $(jq -r '.awsProfile' npk-settings.json) ec2 --region us-west-1 describe-availability-zones | jq '{"us-west-1": [.AvailabilityZones[] | select(.State=="available") | .ZoneName]}' > r3.json
echo "[*] - us-west-2"
aws --profile $(jq -r '.awsProfile' npk-settings.json) ec2 --region us-west-2 describe-availability-zones | jq '{"us-west-2": [.AvailabilityZones[] | select(.State=="available") | .ZoneName]}' > r4.json

jq -s '.[0] * .[1] * .[2] * .[3]' r1.json r2.json r3.json r4.json | jq '{"regions": .}' > regions.json
rm r1.json r2.json r3.json r4.json

if [[ "$(cat regions.json | wc -l)" -lt "4" ]]; then
	echo -e "\n[!] Error retrieving AWS availability zones. Check the 'awsProfile' setting and try again"
	exit 1
fi

echo "[*] Checking service-linked roles for EC2 spot fleets"
aws --profile $(jq -r '.awsProfile' npk-settings.json) iam get-role --role-name AmazonEC2SpotFleetRole > /dev/null
if [[ $? -eq 255 ]]; then
	echo "[+] Creating service-linked roles for EC2 spot fleets"
	aws --profile $(jq -r '.awsProfile' npk-settings.json) iam create-role --role-name AmazonEC2SpotFleetRole --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Sid":"","Effect":"Allow","Principal":{"Service":"spotfleet.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
	aws --profile $(jq -r '.awsProfile' npk-settings.json) iam attach-role-policy --policy-arn arn:aws:iam::aws:policy/service-role/AmazonEC2SpotFleetTaggingRole --role-name AmazonEC2SpotFleetRole
	aws --profile $(jq -r '.awsProfile' npk-settings.json) iam create-service-linked-role --aws-service-name spot.amazonaws.com
	aws --profile $(jq -r '.awsProfile' npk-settings.json) iam create-service-linked-role --aws-service-name spotfleet.amazonaws.com
fi


echo "[*] Retrieving AWS credentials from profile"

# Get credentials from AWSCLI
AWS_ACCESS_KEY_ID=$(aws configure get $(jq -r '.awsProfile' npk-settings.json).aws_access_key_id)
AWS_SECRET_ACCESS_KEY=$(aws configure get $(jq -r '.awsProfile' npk-settings.json).aws_secret_access_key)

echo "[*] Generating combined settings file"
# Merge them into a single config
echo "{\"access_key\": \"$AWS_ACCESS_KEY_ID\", \"secret_key\": \"$AWS_SECRET_ACCESS_KEY\"}" > credentials.json
jq -s '.[0] * .[1] * .[2]' npk-settings.json regions.json credentials.json > generated-settings.jsonnet
rm credentials.json regions.json

echo "[*] Generating Terraform configurations"
# Generate terraform configs
jsonnet -m . terraform.jsonnet

echo "[*] Creating dynamic templates"
# Inject the dynamic template content into the template
cat templates/api_handler_variables-fresh.tpl > templates/api_handler_variables.tpl
cat template-inject_api_handler.json >> templates/api_handler_variables.tpl
cat templates/npk_settings-fresh.tpl > templates/npk_settings.tpl
cat template-inject_api_handler.json | jq -r 'to_entries | map( {(.key) : (.value | keys)}) | add' >> templates/npk_settings.tpl

echo -n "}" >> templates/api_handler_variables.tpl
echo -n "}" >> templates/npk_settings.tpl

terraform init
terraform apply -auto-approve
terraform apply -auto-approve	# Yes, userdata.sh is an unresolvable cyclical dependency. I am ashamed.