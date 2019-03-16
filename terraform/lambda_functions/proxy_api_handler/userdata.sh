#! /bin/bash
cd /root/

APIGATEWAY=rc9vbh8dlk.execute-api.us-west-2.amazonaws.com
echo $APIGATEWAY > /root/apigateway

declare -A BUCKETS
BUCKETS[us-east-1]=npk-dictionary-east-1-20181029005812833000000004
BUCKETS[us-east-2]=npk-dictionary-east-2-20181029005812776500000003
BUCKETS[us-west-1]=npk-dictionary-west-1-20181029005812746900000001
BUCKETS[us-west-2]=npk-dictionary-west-2-20181029005812750900000002

USERDATA=npk-user-data-20190314165032881400000010

INSTANCE_ID=`wget -qO- http://169.254.169.254/latest/meta-data/instance-id`
REGION=`wget -qO- http://169.254.169.254/latest/meta-data/placement/availability-zone | sed 's/.$//'`
aws ec2 describe-tags --region $REGION --filter "Name=resource-id,Values=$INSTANCE_ID" --output=text | sed -r 's/TAGS\t(.*)\t.*\t.*\t(.*)/\1="\2"/' | sed -r 's/aws:ec2spot:fleet-request-id/SpotFleet/' > ec2-tags

. ec2-tags

echo $ManifestPath > /root/manifestpath

BUCKET=${BUCKETS[$REGION]}

mkdir /potfiles

# format & mount /dev/xvdb
mkfs.ext4 /dev/xvdb
mkdir /xvdb
mount /dev/xvdb /xvdb/
mkdir /xvdb/npk-wordlist
ln -s /xvdb/npk-wordlist /root/npk-wordlist

aws s3 cp s3://$BUCKET/components/epel.rpm .
aws s3 cp s3://$BUCKET/components/hashcat.7z .
aws s3 cp s3://$BUCKET/components/maskprocessor.7z .
aws s3 cp s3://$BUCKET/components/compute-node.zip .
aws s3 cp s3://$USERDATA/$ManifestPath/manifest.json .
rpm -Uvh epel.rpm
yum install -y p7zip p7zip-plugins jq

# Install nvm
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.2/install.sh | /bin/bash

mv /.nvm /root/
[ -s "/root/.nvm/nvm.sh" ] && \. "/root/.nvm/nvm.sh"
[ -s "/root/.nvm/bash_completion" ] && \. "/root/.nvm/bash_completion"

# Install NodeJS v8
nvm install 8

# Retrieve the hashes file
wget -O hashes.txt "$(jq -r '.hashFileUrl' manifest.json)"

# Make the dirs
mkdir npk-wordlist
mkdir npk-rules

# Get all manifest components
jq -r '.dictionaryFile' manifest.json | xargs -L1 -I'{}' aws s3 cp s3://$BUCKET/{} ./npk-wordlist/
jq -r '.rulesFiles[]' manifest.json | xargs -L1 -I'{}' aws s3 cp s3://$BUCKET/{} ./npk-rules/

# Unzip them
7z x ./npk-wordlist/* -o./npk-wordlist/
7z x ./npk-rules/* -o./npk-rules/

# Delete the originals
jq -r '.dictionaryFile' manifest.json | xargs -L1 -I'{}' rm ./npk-{}
jq -r '.rulesFiles[]' manifest.json | xargs -L1 -I'{}' rm ./npk-{}

# Link the output file to potfiles
ln -s /var/log/cloud-init-output.log /potfiles/${INSTANCE_ID}-output.log

# Create the crontab to sync s3
echo "* * * * * root aws s3 sync s3://$USERDATA/$ManifestPath/potfiles/ /potfiles/" >> /etc/crontab
echo "* * * * * root aws s3 sync /potfiles/ s3://$USERDATA/$ManifestPath/potfiles/" >> /etc/crontab

aws ec2 describe-spot-fleet-instances --region $REGION --spot-fleet-request-id $SpotFleet | jq '.ActiveInstances[].InstanceId' | sort > fleet_instances
cat fleet_instances | wc -l > instance_count
cat fleet_instances | grep -nr $INSTANCE_ID - | cut -d':' -f1 > instance_number
echo $INSTANCE_ID > instance_id
echo $REGION > region

7z x hashcat.7z
7z x maskprocessor.7z
mv hashcat-5.0.0/ hashcat
mv maskprocessor-0.73/ maskprocessor

if [[ "$(jq -r '.attackType' manifest.json)" == "0" ]]; then
	aws s3api head-object --bucket $BUCKET --key $(jq -r '.dictionaryFile' manifest.json) | jq -r '.Metadata.lines' > /root/keyspace
elif [[ "$(jq -r '.attackType' manifest.json)" == "3" ]]; then
	/root/hashcat/hashcat64.bin --keyspace -a 3 $(jq -r '.mask' /root/manifest.json) > /root/keyspace
else
	/root/hashcat/hashcat64.bin --keyspace -a $(jq -r '.attackType' /root/manifest.json) npk-wordlist/* > /root/keyspace
fi

unzip -d compute-node compute-node.zip
node compute-node/maskprocessor.js

# Create the snitch
echo "* * * * * root /root/compute-node/kill_if_dead.sh" >> /etc/crontab

node compute-node/hashcat_wrapper.js
aws s3 sync /potfiles/ s3://$USERDATA/$ManifestPath/potfiles/
# /root/hashcat/hashcat64.bin -O -w 4 -b --benchmark-all | tee /potfiles/benchmark-results.txt