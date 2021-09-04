#! /bin/bash

if [[ -f quickdeployed ]]; then
	"[+] You've already run the quickdeploy wizard."
fi

if [[ -f npk-settings.json ]]; then
	read -r -p "[!] quickdeploy will overwrite your existing npk-settings.json. Type 'Yes' to proceed: " key

	if [[ "$key" != "Yes" ]]; then
		echo "Only 'Yes' will be accepted."
		echo ""

		exit 1
	fi
fi

read -r -p "[?] Which AWS profile do you want to deploy NPK with? [e.g. default]: " profile

echo "[*] Testing the profile..."
aws --profile $profile sts get-caller-identity > /dev/null
if [[ $? -ne 0 ]]; then
	echo "[!] The provided profile is not valid. Try again."
	exit 1
fi

echo "NPK will provision an administrative account for the first user, and send login details via email."
read -r -p "[?] What is the email address of the admin user?: " email
echo
echo "NPK sends critical event notifications via SMS. These are exceptionally rare,"
echo " but could indicate a cost overrun. As such, you should use a real number."
echo " The number must include the country code and a '+' at the front."
read -r -p "[?] What number should SMS notifications be sent to? [e.g: +13035551234]: " sms
echo

BUCKET="npk-terraform-quickdeploy-$(pwgen -A -0 12 1)"

jq -n --arg profile $profile --arg email $email --arg sms $sms --arg bucket $BUCKET '{
	"backend_bucket": $bucket,
	"campaign_data_ttl": 604800,
	"campaign_max_price": 50,
	"awsProfile": $profile,
	"criticalEventsSMS": $sms,
	"adminEmail": $email,
}' >>  npk-settings.json

touch quickdeployed

./deploy.sh