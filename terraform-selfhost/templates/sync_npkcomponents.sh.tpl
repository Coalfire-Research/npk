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

BUCKET1=${de1}
REGION1="us-east-1"

BUCKET2=${de2}
REGION2="us-east-2"

BUCKET3=${dw1}
REGION3="us-west-1"

BUCKET4=${dw2}
REGION4="us-west-2"

echo "- syncing upstream S3 to selfhosted buckets."
aws s3 sync s3://npk-dictionary-east-1-20181029005812833000000004-2 s3://$BUCKET1 --region $REGION1
aws s3 sync s3://npk-dictionary-east-2-20181029005812776500000003-2 s3://$BUCKET2 --region $REGION2
aws s3 sync s3://npk-dictionary-east-1-20181029005812833000000004-2 s3://$BUCKET3 --region $REGION3
aws s3 sync s3://npk-dictionary-west-1-20181029005812746900000001-2 s3://$BUCKET4 --region $REGION4

echo "- buckets synced."