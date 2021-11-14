#! /bin/bash

ERR=0;
if [[ ! -f $(which wget) ]]; then
	ERR=1;
	echo "Error: Must have 'wget' command installed.";
fi

if [[ ! -f $(which aws) ]]; then
	ERR=1;
	echo "Error: Must have AWSCLI installed.";
fi

if [[ "$ERR" == "1" ]]; then
	echo -e "\nSyntax: $0 <awscli_options>\n"
	exit 1
fi

export AWS_DEFAULT_REGION=us-west-2
export AWS_DEFAULT_OUTPUT=json
export AWS_PROFILE=$(jq -r '.awsProfile' ../terraform/npk-settings.json)

echo "- syncing upstream S3 to selfhosted buckets."
aws s3 sync s3://npk-dictionary-west-2-20181029005812750900000002 s3://${dictionaryBucket} --source-region us-west-2 --region ${dictionaryBucketRegion}

echo "- buckets synced."