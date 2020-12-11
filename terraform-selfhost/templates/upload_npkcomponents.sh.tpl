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

echo "- Downloading components"
if [ ! -f ${basepath}/components/hashcat.7z ]; then
	wget -O ${basepath}/components/hashcat.7z ${hashcat}
fi

if [ ! -f ${basepath}/components/maskprocessor.7z ]; then
	wget -O ${basepath}/components/maskprocessor.7z https://github.com/hashcat/maskprocessor/releases/download/v0.73/maskprocessor-0.73.7z
fi

if [ ! -f ${basepath}/components/epel.rpm ]; then
	wget -O ${basepath}/components/epel.rpm https://npk-dictionary-east-1-20181029005812833000000004-2.s3.us-east-1.amazonaws.com/components/epel.rpm
fi

echo "- Uploading to S3"
aws s3 sync ${basepath}/components/ s3://$BUCKET1/components-v2/ $${@:1} --region $REGION1
aws s3 sync ${basepath}/components/ s3://$BUCKET2/components-v2/ $${@:1} --region $REGION2
aws s3 sync ${basepath}/components/ s3://$BUCKET3/components-v2/ $${@:1} --region $REGION3
aws s3 sync ${basepath}/components/ s3://$BUCKET4/components-v2/ $${@:1} --region $REGION4


echo -e "Done.\n\n"