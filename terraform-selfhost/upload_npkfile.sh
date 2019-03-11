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

if [[ $# -lt 4 ]]; then
	ERR=1
fi

if [[ "$ERR" == "1" ]]; then
	echo -e "\nSyntax: $0 <file_type = 'wordlist'|'rules'> <file> [<awscli_options>...]\n"
	exit 1
fi

BUCKET1=npk-dictionary-east-1-20181029005812833000000004
REGION1="us-east-1"

BUCKET2=npk-dictionary-east-2-20181029005812776500000003
REGION2="us-east-2"

BUCKET3=npk-dictionary-west-1-20181029005812746900000001
REGION3="us-west-1"

BUCKET4=npk-dictionary-west-2-20181029005812750900000002
REGION4="us-west-2"

FILENAME=$(echo ${2##*/})
ARCHIVE=$(echo ${FILENAME%.*}).7z
LINES=$(wc -l $2 | cut -d" " -f1)
SIZE=$(ls -al $2 | cut -d" " -f5)
echo "Processing $1 $FILENAME"
echo "- Compressing"
7z a $ARCHIVE $2

echo "- Uploading to S3"
aws s3 cp $ARCHIVE s3://$BUCKET1/$1/ ${@:3} --metadata type=$1,lines=$LINES,size=$SIZE --region $REGION1
aws s3 cp $ARCHIVE s3://$BUCKET2/$1/ ${@:3} --metadata type=$1,lines=$LINES,size=$SIZE --region $REGION2
aws s3 cp $ARCHIVE s3://$BUCKET3/$1/ ${@:3} --metadata type=$1,lines=$LINES,size=$SIZE --region $REGION3
aws s3 cp $ARCHIVE s3://$BUCKET4/$1/ ${@:3} --metadata type=$1,lines=$LINES,size=$SIZE --region $REGION4
rm $ARCHIVE

echo -e "Done.\n\n"