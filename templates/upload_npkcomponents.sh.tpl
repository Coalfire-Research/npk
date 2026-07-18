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

echo "- Downloading components"
# if [ ! -f ${basepath}/components/hashcat.7z ]; then
# 	wget -O ${basepath}/components/hashcat.7z https://hashcat.net/files/hashcat-7.1.1.7z
# fi

# if [ ! -f ${basepath}/components/maskprocessor.7z ]; then
# 	wget -O ${basepath}/components/maskprocessor.7z https://github.com/hashcat/maskprocessor/releases/download/v0.73/maskprocessor-0.73.7z
# fi


echo "- Uploading to S3"
aws s3 sync ${basepath}/components/ s3://${dictionaryBucket}/components-v3/ $${@:1} --region ${dictionaryBucketRegion}


echo -e "Done.\n\n"
