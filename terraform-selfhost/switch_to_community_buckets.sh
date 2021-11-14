#! /bin/bash

echo "**"
echo
echo ">> The switch_to_community_buckets.sh script is deprecated. Please use 'npm run community' instead."
echo
echo "**"

exit 1

echo ""
echo "This will configure your NPK installation to use the community dictionary buckets. A few things to note:"
echo "-> 1. This script will automatically trigger a deployment with terraform. Do no proceed if you don't want this to happen."
echo "-> 2. This will NOT delete any self-hosted buckets you may have (use 'terraform destroy' in the 'terraform-selfhost' folder for that)."
echo "-> 3. To switch back to self-hosted buckets, run './deploy-selfhost.sh' from the 'terraform-selfhost' folder."
echo ""
read -r -p " Do you understand and wish to proceed? [Yes]: " key

if [[ "$key" != "Yes" ]]; then
	echo "You must accept the warning with 'Yes' in order to continue."
	echo ""

	exit 1
fi

echo ""
echo "[+] Copying community configurations to NPK installation"
cp community_configs/dictionaries.tfvars ../terraform/dictionaries.auto.tfvars

echo "[+] Deploying changes..."
cd ../terraform/
npm run deploy