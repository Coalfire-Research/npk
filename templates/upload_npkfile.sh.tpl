#! /bin/bash

ERR=0;
if [[ ! -f $(which 7z) ]]; then
	ERR=1;
	echo "Error: Must have '7z' command installed.";
fi

if [[ ! -f $(which aws) ]]; then
	ERR=1;
	echo "Error: Must have AWSCLI installed.";
fi

if [[ "$1" != "wordlist" && "$1" != "rules" ]]; then
	echo "Error: <file_type> must be 'wordlist' or 'rules'"
	ERR=1
fi

if [[ $# -lt 2 ]]; then
	ERR=1
fi

if [[ "$ERR" == "1" ]]; then
	echo -e "\nSyntax: $0 <file_type = 'wordlist'|'rules'> <file> [<awscli_options>...]\n"
	exit 1
fi

export AWS_DEFAULT_REGION=us-west-2
export AWS_DEFAULT_OUTPUT=json
export AWS_PROFILE=$(jq -r '.awsProfile' ../terraform/npk-settings.json)

FILENAME=$(echo $${2##*/})
echo "Processing $1 $FILENAME"
ARCHIVE=$(echo $${FILENAME%.*}).7z
echo "- Counting lines"
FILELINES=$(wc -l $2 | cut -d" " -f1)
SIZE=$(ls -ao $2 | cut -d" " -f4)
echo "- Compressing"
7z a $ARCHIVE $2

echo "- Uploading to S3"
aws s3 cp $ARCHIVE s3://${dictionaryBucket}/$1/ $${@:3} --metadata type=$1,lines=$FILELINES,size=$SIZE --region ${dictionaryBucketRegion}

rm $ARCHIVE

echo -e "Done.\n\n"