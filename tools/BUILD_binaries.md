# Steps to build Hashcat binaries
Compilation is required for ARM instances since the Hashcat project does not provide ARM binaries.

Note that NPK includes these builds. The steps are provided for future updates or if customization is needed.

## Prerequisites
Default builds were compiled on Amazon Linux 2023 ARM instance with development tools installed.
```sh
yum groupinstall -y "Development Tools"
yum install -y p7zip p7zip-plugins
```
Check the BUILD instruction files on https://github.com/hashcat/hashcat for other configurations.

## Building maskprocessor
```sh
git clone https://github.com/hashcat/maskprocessor.git
cd ./maskprocessor/src
sed -i 's/-m64/-march=armv8.2-a/g' Makefile
make
mkdir maskprocessor-0.73
cp ../LICENSE mp64.bin maskprocessor-0.73/

# Create the arm64 package
7z a maskprocessor.arm64.7z maskprocessor-0.73
```

## Building Hashcat
```sh
# Building without Python3 headers, ignoring the two missing hash modes.
git clone https://github.com/hashcat/hashcat.git
cd hashcat
git checkout -b v7.1.1 tags/v7.1.1
make

rm -rf .??* Makefile README.md src deps docker include obj tools BUILD*
mv hashcat hashcat.bin
mkdir hashcat-7.1.1
mv * hashcat-7.1.1

# Create the arm64 package
# 7z a hashcat.arm64.7z hashcat-7.1.1

# Create the AL2 package
# 7z a hashcat.al2.7z hashcat-7.1.1
```
