#! /bin/bash -x

shutdown_on_exit() {
	echo "[!] Script exited. Shutting down in two minutes."
	shutdown +2
}

trap shutdown_on_exit EXIT
set -e

# amazon-linux-extras install -y epel
yum install -y wget p7zip pv

# Discover the root device and exclude it from data disks
echo "[*] Disk layout:"
lsblk -o NAME,TYPE,SIZE,MOUNTPOINT

ROOT_PART=$(findmnt -no SOURCE /)
ROOT_DISK=$(lsblk -no PKNAME "$ROOT_PART" 2>/dev/null || true)

if [[ -z "$ROOT_DISK" ]]; then
  echo "[!] Could not determine root disk; aborting to avoid formatting the wrong device."
  lsblk -o NAME,TYPE,MOUNTPOINT
  exit 1
fi

# Find NVMe "disk" devices that are NOT the root disk
mapfile -t DATA_DISKS < <(
  lsblk -ndo NAME,TYPE | awk -v root="$ROOT_DISK" '
    $2=="disk" && $1 ~ /^nvme/ && $1 != root { print "/dev/"$1 }
  '
)

if [[ ${#DATA_DISKS[@]} -eq 0 ]]; then
  echo "[!] No non-root NVMe data disks found; cannot continue."
  exit 1
fi

RAW_DEV="${DATA_DISKS[0]}"
COMP_DEV="${DATA_DISKS[1]:-}"

echo "[*] Using $RAW_DEV for raw data"
[[ -n "$COMP_DEV" ]] && echo "[*] Using $COMP_DEV for compressed data"

mkfs.ext4 "$RAW_DEV"

if [[ -n "$COMP_DEV" ]]; then
  mkfs.ext4 "$COMP_DEV"

  mkdir -p /npk/raw /npk/compressed
  mount "$RAW_DEV" /npk/raw
  mount "$COMP_DEV" /npk/compressed
else
  mkdir -p /npk
  mount "$RAW_DEV" /npk
  mkdir -p /npk/raw /npk/compressed
fi

export TOKEN=`curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600"`
export AWS_DEFAULT_REGION=`wget "--header=X-aws-ec2-metadata-token: $TOKEN" -qO- http://169.254.169.254/latest/meta-data/placement/availability-zone | sed 's/.$//'`
export AWS_DEFAULT_OUTPUT=json

export TARGETFILE={{targetfile}}
export TARGETFILETYPE={{targetfiletype}}
if [[ `echo $TARGETFILE | grep s3: | wc -l` -gt 0 ]]; then
	aws s3 cp $TARGETFILE /npk/raw/rawfile
else
	wget $targetfile -O /npk/raw/rawfile
fi

ls -alh /npk/raw/rawfile
FILETYPE=`file -b /npk/raw/rawfile`
FILENAME=`echo ${TARGETFILE##*/} | cut -d"?" -f1`

if [[ `echo $FILETYPE | grep text | wc -l` -eq 0 ]]; then
	echo "[+] File is compressed. Attempting to decompress"
	7za l /npk/raw/rawfile

	mv /npk/raw/rawfile /npk/raw/cprfile
	FIRSTFILE=`7za l /npk/raw/cprfile | tail -n 3 | head -n 1 | awk ' { print($6) } '`
	FILENAME=${FIRSTFILE##*/}
	7za x -bsp1 /npk/raw/cprfile -o/npk/raw/output/
	# rm -f /npk/raw/cprfile
	mv /npk/raw/output/$FILENAME /npk/raw/rawfile
fi

echo [+] Counting lines in file...
FILELINES=$(wc -l /npk/raw/rawfile | cut -d" " -f1)
SIZE=$(ls -al /npk/raw/rawfile | cut -d" " -f5)

# echo "Compressing with 7z"
# 7za a /npk/compressed/$FILENAME.7z /npk/raw/rawfile

echo "Compressing with gzip"
pv -nte /npk/raw/rawfile | gzip -c  > /npk/compressed/$FILENAME.gz

echo "$FILENAME has $FILELINES lines and $SIZE bytes. Preparing to upload as $TARGETFILETYPE."

aws s3 cp /npk/compressed/$FILENAME.gz s3://{{dictionarybucket}}/$TARGETFILETYPE/$FILENAME.gz --metadata type=$TARGETFILETYPE,lines=$FILELINES,size=$SIZE

if [[ `echo $TARGETFILE | grep s3: | wc -l` -gt 0 ]]; then
	aws s3 rm $TARGETFILE
fi