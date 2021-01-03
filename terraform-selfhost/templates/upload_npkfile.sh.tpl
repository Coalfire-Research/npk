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

BUCKET1=${de1}
REGION1="us-east-1"

BUCKET2=${de2}
REGION2="us-east-2"

BUCKET3=${dw1}
REGION3="us-west-1"

BUCKET4=${dw2}
REGION4="us-west-2"

FILENAME=$(echo $${2##*/})
echo "Processing $1 $FILENAME"
ARCHIVE=$(echo $${FILENAME%.*}).7z
echo "- Counting lines"
FILELINES=$(wc -l $2 | cut -d" " -f1)
SIZE=$(ls -al $2 | cut -d" " -f5)
echo "- Compressing"
7z a $ARCHIVE $2

echo "- Uploading to S3"
aws s3 cp $ARCHIVE s3://$BUCKET1/$1/ $${@:3} --metadata type=$1,lines=$FILELINES,size=$SIZE --region $REGION1
aws s3 cp $ARCHIVE s3://$BUCKET2/$1/ $${@:3} --metadata type=$1,lines=$FILELINES,size=$SIZE --region $REGION2
aws s3 cp $ARCHIVE s3://$BUCKET3/$1/ $${@:3} --metadata type=$1,lines=$FILELINES,size=$SIZE --region $REGION3
aws s3 cp $ARCHIVE s3://$BUCKET4/$1/ $${@:3} --metadata type=$1,lines=$FILELINES,size=$SIZE --region $REGION4
rm $ARCHIVE

echo -e "Done.\n\n"