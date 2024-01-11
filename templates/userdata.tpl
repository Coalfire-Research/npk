#! /bin/bash
cd /root/

echo {{APIGATEWAY}} > /root/apigateway

export APIGATEWAY=$(cat /root/apigateway)
export USERDATA=${userdata}
export USERDATAREGION=${userdataRegion}
export INSTANCEID=`wget -qO- http://169.254.169.254/latest/meta-data/instance-id`
export REGION=`wget -qO- http://169.254.169.254/latest/meta-data/placement/availability-zone | sed 's/.$//'`
aws ec2 describe-tags --region $REGION --filter "Name=resource-id,Values=$INSTANCEID" --output=text | sed -r 's/TAGS\t(.*)\t.*\t.*\t(.*)/\1="\2"/' | sed -r 's/aws:ec2spot:fleet-request-id/SpotFleet/' > ec2-tags

. ec2-tags

# This is required for the wrapper to get anything done.
export ManifestPath=$ManifestPath
echo $ManifestPath > /root/manifestpath

if [[ -f $(which yum) ]]; then
	yum install -y jq
else
	apt-get update
	apt-get install -y jq wget p7zip-full maskprocessor
fi

export BUCKET=${dictionaryBucket}
export BUCKETREGION=${userdataRegion}

echo "Using dictionary bucket $BUCKET";

mkdir /potfiles

# format & mount /dev/xvdb
if [[ -e /dev/xvdb ]]; then
	mkfs.ext4 /dev/xvdb
	mkdir /xvdb
	mount /dev/xvdb /xvdb/
	mkdir /xvdb/npk-wordlist
	ln -s /xvdb/npk-wordlist /root/npk-wordlist
else
	mkfs.ext4 /dev/nvme1n1
	mkdir /nvme1n1
	mount /dev/nvme1n1 /nvme1n1/
	mkdir /nvme1n1/npk-wordlist
	ln -s /nvme1n1/npk-wordlist /root/npk-wordlist
fi;

aws s3 cp s3://$BUCKET/components-v3/compute-node.7z .
aws s3 cp s3://$USERDATA/$ManifestPath/manifest.json .

if [[ -f $(which yum) ]]; then
	aws s3 cp s3://$BUCKET/components-v3/epel.rpm .
	rpm -Uvh epel.rpm
	yum install -y p7zip p7zip-plugins
fi

if [[ `lspci | grep AMD | wc -l` -gt 0 ]]; then
	yum install -y opencl-amdgpu-pro
fi

# Install nvm
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.2/install.sh | /bin/bash

mv /.nvm /root/
[ -s "/root/.nvm/nvm.sh" ] && \. "/root/.nvm/nvm.sh"
[ -s "/root/.nvm/bash_completion" ] && \. "/root/.nvm/bash_completion"

# Install NodeJS v17.0.1
nvm install 17.0.1

# Retrieve the hashes file
wget -O hashes.txt "$(jq -r '.hashFileUrl' manifest.json)"

# Make the dirs
mkdir npk-rules

# Get all manifest components
jq -r '.dictionaryFile' manifest.json | xargs -L1 -I'{}' aws --region $BUCKETREGION s3 cp s3://$BUCKET/{} ./npk-wordlist/
jq -r '.rulesFiles[]' manifest.json | xargs -L1 -I'{}' aws --region $BUCKETREGION s3 cp s3://$BUCKET/{} ./npk-rules/

# Unzip them
# 7z x ./npk-wordlist/* -o./npk-wordlist/
# 7z x ./npk-rules/* -o./npk-rules/

jq -r '.dictionaryFile' manifest.json | grep \.7z$ | xargs -L1 -I'{}' 7z x ./npk-{} -o./npk-wordlist/
jq -r '.dictionaryFile' manifest.json | grep \.gz$ | xargs -L1 -I'{}' gunzip ./npk-{}

jq -r '.rulesFiles[]' manifest.json | grep \.7z$ | xargs -L1 -I'{}' 7z x ./npk-{} -o./npk-rules/
jq -r '.rulesFiles[]' manifest.json | grep \.gz$ | xargs -L1 -I'{}' gunzip ./npk-{}

ls -alh ./npk-rules/

# Delete the originals
jq -r '.dictionaryFile' manifest.json | xargs -L1 -I'{}' rm ./npk-{}
jq -r '.rulesFiles[]' manifest.json | xargs -L1 -I'{}' rm -f ./npk-{}

# Link the output file to potfiles
ln -s /var/log/cloud-init-output.log /potfiles/$${INSTANCEID}-output.log

echo <<EOF > /root/monitor_instance_action.sh
#! /bin/bash

ACTIONS=\$(curl -s --head http://169.254.169.254/latest/meta-data/spot/intance_action | grep 404 | wc -l)
if [[ \$ACTIONS -ne 1 ]]; then
	wget -O /potfiles/$${INSTANCEID}-instance_action.json http://169.254.169.254/latest/meta-data/spot/intance_action
	aws --region $USERDATAREGION s3 sync /potfiles/ s3://$USERDATA/$ManifestPath/potfiles/ --include \"*$${INSTANCEID}*\"
fi
EOF

chmod +x /root/monitor_instance_action.sh

cat /root/monitor_instance_action.sh

# Create the crontab to sync s3
echo "* * * * * root aws --region $USERDATAREGION s3 sync s3://$USERDATA/$ManifestPath/potfiles/ /potfiles/ --exclude \"*$${INSTANCEID}*\" --exclude \"*benchmark-results*\"" >> /etc/crontab
echo "* * * * * root aws --region $USERDATAREGION s3 sync /potfiles/ s3://$USERDATA/$ManifestPath/potfiles/ --include \"*$${INSTANCEID}*\" --include \"*benchmark-results*\"" >> /etc/crontab
echo "* * * * * root /root/monitor_instance_action.sh" >> /etc/crontab

aws ec2 describe-spot-fleet-instances --region $REGION --spot-fleet-request-id $SpotFleet | jq '.ActiveInstances[].InstanceId' | sort > fleet_instances
export INSTANCECOUNT=$(cat fleet_instances | wc -l)
export INSTANCENUMBER=$(cat fleet_instances | grep -nr $INSTANCEID - | cut -d':' -f1)

if [[ $(uname -a | grep x86_64 | wc -l) -eq 1 ]]; then
	aws s3 cp s3://$BUCKET/components-v3/hashcat.7z .
	aws s3 cp s3://$BUCKET/components-v3/maskprocessor.7z .

	7z x hashcat.7z
	7z x maskprocessor.7z
	mv hashcat-*/ hashcat
	mv maskprocessor-*/ maskprocessor
else
	aws s3 cp s3://$BUCKET/components-v3/hashcat.arm64.7z .
	7z x hashcat.arm64.7z
	mv /root/hashcat/hashcat /root/hashcat/hashcat.bin
	mkdir /root/maskprocessor
	ln -s $(which mp64) /root/maskprocessor/mp64.bin
fi

7z x compute-node.7z

# Put the envvars in a useful place, in case debugging is needed.
echo "export APIGATEWAY=$APIGATEWAY" >> envvars
echo "export USERDATA=$USERDATA" >> envvars
echo "export USERDATAREGION=$USERDATAREGION" >> envvars
echo "export INSTANCEID=$INSTANCEID" >> envvars
echo "export REGION=$REGION" >> envvars
echo "export BUCKET=$BUCKET" >> envvars
echo "export BUCKETREGION=$BUCKETREGION" >> envvars
echo "export ManifestPath=$ManifestPath" >> envvars
echo "export INSTANCECOUNT=$INSTANCECOUNT" >> envvars
echo "export INSTANCENUMBER=$INSTANCENUMBER" >> envvars
echo "export KEYSPACE=$KEYSPACE" >> envvars
chmod +x envvars

# If we have a mask specified for a non-mask attack type, generate a rule file from the mask:
if [[ "$(jq -r '.attackType' manifest.json)" != "3" && "$(jq -r '.mask' manifest.json)" != "null" ]]; then
	MASK=$(jq -r '.mask' manifest.json | sed 's/?/ $?/g')
	MASK=$${MASK:1}

	echo "[*] Manifest has mask of [$MASK]"

	if [[ $(echo $MASK | wc -c) -gt 0 ]]; then
		echo "/root/maskprocessor/mp64.bin -o /root/npk-rules/npk-maskprocessor.rule \"$MASK\""
		/root/maskprocessor/mp64.bin -o /root/npk-rules/npk-maskprocessor.rule "$MASK"
		echo : >> /root/npk-rules/npk-maskprocessor.rule
		echo "Mask rule created with $(cat /root/npk-rules/npk-maskprocessor.rule | wc -l) entries"
	fi
fi

# Use this for normal operations
node compute-node/hashcat_wrapper.js
echo "[*] Hashcat wrapper finished with status code $?"
# aws s3 sync /potfiles/ s3://$USERDATA/$ManifestPath/potfiles/
aws --region $USERDATAREGION s3 sync /potfiles/ s3://$USERDATA/$ManifestPath/potfiles/ --include "*$${INSTANCEID}*" --include "*benchmark-results*" --include "all_cracked_hashes.txt"
sleep 30

if [[ ! -f /root/nodeath ]]; then
	poweroff
fi
# ===============================

# Use this to generate benchmarks
# /root/hashcat/hashcat.bin -O -w 4 -b --benchmark-all | tee /potfiles/benchmark-results.txt
# aws --region $USERDATAREGION s3 cp /potfiles/benchmark-results.txt s3://$USERDATA/$ManifestPath/potfiles/

# poweroff
# ===============================

# Use this to generate wordlist benchmarks
# aws s3 cp s3://$BUCKET/components-v3/hashstash.7z .
# 7z x hashstash.7z
# ls hashstash | awk ' { system("./hashcat/hashcat.bin -O -w 4 --keep-guessing --runtime 20 -m " $1 " -a 0 -r npk-rules/npk-maskprocessor.rule -r npk-rules/OneRuleToRuleThemAll.rule ./hashstash/" $1 " ./npk-wordlist/rockyou.txt | grep -e Speed.# -e Hash.Mode | tee -a /potfiles/wordlist-benchmark-results.txt") } '
# aws --region $USERDATAREGION s3 cp /potfiles/wordlist-benchmark-results.txt s3://$USERDATA/$ManifestPath/potfiles/

# poweroff
# ===============================