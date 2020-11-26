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

BUCKET1=npk-dictionary-east-1-20181029005812833000000004-2
REGION1="us-east-1"

BUCKET2=npk-dictionary-east-2-20181029005812776500000003-2
REGION2="us-east-2"

BUCKET3=npk-dictionary-west-1-20181029005812746900000001-2
REGION3="us-west-1"

BUCKET4=npk-dictionary-west-2-20181029005812750900000002-2
REGION4="us-west-2"

echo "- Downloading components"
if [ ! -f /home/brad/repos/npk/terraform-selfhost/components/hashcat.7z ]; then
	wget -O /home/brad/repos/npk/terraform-selfhost/components/hashcat.7z https://hashcat.net/files/hashcat-5.0.0.7z
fi

if [ ! -f /home/brad/repos/npk/terraform-selfhost/components/maskprocessor.7z ]; then
	wget -O /home/brad/repos/npk/terraform-selfhost/components/maskprocessor.7z https://github.com/hashcat/maskprocessor/releases/download/v0.73/maskprocessor-0.73.7z
fi

if [ ! -f /home/brad/repos/npk/terraform-selfhost/components/epel.rpm ]; then
	wget -O /home/brad/repos/npk/terraform-selfhost/components/epel.rpm https://dl.fedoraproject.org/pub/epel/7/x86_64/Packages/e/epel-release-7-11.noarch.rpm
fi

echo "- Uploading to S3"
aws s3 sync /home/brad/repos/npk/terraform-selfhost/components/ s3://$BUCKET1/components/ ${@:1} --delete --region $REGION1
aws s3 sync /home/brad/repos/npk/terraform-selfhost/components/ s3://$BUCKET2/components/ ${@:1} --delete --region $REGION2
aws s3 sync /home/brad/repos/npk/terraform-selfhost/components/ s3://$BUCKET3/components/ ${@:1} --delete --region $REGION3
aws s3 sync /home/brad/repos/npk/terraform-selfhost/components/ s3://$BUCKET4/components/ ${@:1} --delete --region $REGION4

echo -e "Done.\n\n"
