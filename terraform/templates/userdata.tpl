#! /bin/bash
cd /root/

echo {{APIGATEWAY}} > /root/apigateway

export APIGATEWAY=$(cat /root/apigateway)
export USERDATA=${userdata}
export INSTANCEID=`wget -qO- http://169.254.169.254/latest/meta-data/instance-id`
export REGION=`wget -qO- http://169.254.169.254/latest/meta-data/placement/availability-zone | sed 's/.$//'`
aws ec2 describe-tags --region $REGION --filter "Name=resource-id,Values=$INSTANCEID" --output=text | sed -r 's/TAGS\t(.*)\t.*\t.*\t(.*)/\1="\2"/' | sed -r 's/aws:ec2spot:fleet-request-id/SpotFleet/' > ec2-tags

. ec2-tags

# This is required for the wrapper to get anything done.
export ManifestPath=$ManifestPath
echo $ManifestPath > /root/manifestpath

yum install -y jq

export BUCKET=`echo '${dictionaryBuckets}' | jq -r --arg REGION $REGION '.[$REGION]'`

echo "Using dictionary bucket $BUCKET";

mkdir /potfiles

# format & mount /dev/xvdb
mkfs.ext4 /dev/xvdb
mkdir /xvdb
mount /dev/xvdb /xvdb/
mkdir /xvdb/npk-wordlist
ln -s /xvdb/npk-wordlist /root/npk-wordlist

aws s3 cp s3://$BUCKET/components-v2/epel.rpm .
aws s3 cp s3://$BUCKET/components-v2/hashcat.7z .
aws s3 cp s3://$BUCKET/components-v2/maskprocessor.7z .
aws s3 cp s3://$BUCKET/components-v2/compute-node.7z .
aws s3 cp s3://$USERDATA/$ManifestPath/manifest.json .
rpm -Uvh epel.rpm
yum install -y p7zip p7zip-plugins

# Install nvm
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.2/install.sh | /bin/bash

mv /.nvm /root/
[ -s "/root/.nvm/nvm.sh" ] && \. "/root/.nvm/nvm.sh"
[ -s "/root/.nvm/bash_completion" ] && \. "/root/.nvm/bash_completion"

# Install NodeJS v12
nvm install 12

# Retrieve the hashes file
wget -O hashes.txt "$(jq -r '.hashFileUrl' manifest.json)"

# Make the dirs
mkdir npk-rules

# Get all manifest components
jq -r '.dictionaryFile' manifest.json | xargs -L1 -I'{}' aws s3 cp s3://$BUCKET/{} ./npk-wordlist/
jq -r '.rulesFiles[]' manifest.json | xargs -L1 -I'{}' aws s3 cp s3://$BUCKET/{} ./npk-rules/

# Unzip them
# 7z x ./npk-wordlist/* -o./npk-wordlist/
# 7z x ./npk-rules/* -o./npk-rules/
jq -r '.dictionaryFile' manifest.json | xargs -L1 -I'{}' 7z x ./npk-{} -o./npk-wordlist/
jq -r '.rulesFiles[]' manifest.json | xargs -L1 -I'{}' 7z x ./npk-{} -o./npk-rules/

# Delete the originals
jq -r '.dictionaryFile' manifest.json | xargs -L1 -I'{}' rm ./npk-{}
jq -r '.rulesFiles[]' manifest.json | xargs -L1 -I'{}' rm ./npk-{}

# Link the output file to potfiles
ln -s /var/log/cloud-init-output.log /potfiles/$${INSTANCEID}-output.log

# Create the crontab to sync s3
echo "* * * * * root aws s3 sync s3://$USERDATA/$ManifestPath/potfiles/ /potfiles/ --exclude \"*$${INSTANCEID}*\"" >> /etc/crontab
echo "* * * * * root aws s3 sync /potfiles/ s3://$USERDATA/$ManifestPath/potfiles/ --include \"*$${INSTANCEID}*\"" >> /etc/crontab

aws ec2 describe-spot-fleet-instances --region $REGION --spot-fleet-request-id $SpotFleet | jq '.ActiveInstances[].InstanceId' | sort > fleet_instances
export INSTANCECOUNT=$(cat fleet_instances | wc -l)
export INSTANCENUMBER=$(cat fleet_instances | grep -nr $INSTANCEID - | cut -d':' -f1)

7z x hashcat.7z
7z x maskprocessor.7z
mv hashcat-*/ hashcat
mv maskprocessor-*/ maskprocessor

7z x compute-node.7z

# Put the envvars in a useful place, in case debugging is needed.
echo "export APIGATEWAY=$APIGATEWAY" >> envvars
echo "export USERDATA=$USERDATA" >> envvars
echo "export INSTANCEID=$INSTANCEID" >> envvars
echo "export REGION=$REGION" >> envvars
echo "export BUCKET=$BUCKET" >> envvars
echo "export ManifestPath=$ManifestPath" >> envvars
echo "export INSTANCECOUNT=$INSTANCECOUNT" >> envvars
echo "export INSTANCENUMBER=$INSTANCENUMBER" >> envvars
echo "export KEYSPACE=$KEYSPACE" >> envvars
chmod +x envvars

node compute-node/hashcat_wrapper.js
echo "[*] Hashcat wrapper finished with status code $?"
aws s3 sync /potfiles/ s3://$USERDATA/$ManifestPath/potfiles/
sleep 30
#/root/hashcat/hashcat.bin -O -w 4 -b --benchmark-all > benchmark-results.txt

if [[ ! -f /root/nodeath ]]; then
	poweroff
fi