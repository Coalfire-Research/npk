#! /bin/bash

# curl https://npkproject.io/cloudshell_install.sh | bash

TF_CLI_ARGS_apply="-parallelism=1"
NODE_OPTIONS="--max-old-space-size=1536"
NODE_VERSION=20.19.2

if [[ $UID -eq 0 ]]; then
	echo "[!] Don't run this as root."
	return 1
fi

# install compiler and cmake3, aliased to cmake
if [[ ! -f /usr/bin/cmake ]]; then
	echo "[*] Installing CMake3, C++"
	sudo yum install -y cmake3 gcc-c++ > /dev/null
	sudo ln -s /usr/bin/cmake3 /usr/bin/cmake
fi

# install nvm and node
if [[ ! -d /aws/mde/nvm ]]; then
	echo "[*] Installing NVM"
	sudo mkdir /aws/mde/nvm
	sudo chown cloudshell-user:cloudshell-user /aws/mde/nvm

	sudo ln -s /aws/mde/nvm ~/.nvm
	curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash > /dev/null
fi

export NVM_DIR="/aws/mde/nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

echo "[*] Installing node.js ${NODE_VERSION}"
nvm install $NODE_VERSION > /dev/null
nvm alias default $NODE_VERSION
nvm use $NODE_VERSION

# Set up the larger storage environment:
if [[ ! -d /aws/mde/npk ]]; then
	sudo mkdir /aws/mde/npk
	sudo chown cloudshell-user:cloudshell-user /aws/mde/npk
fi

# Pull the repo:
if [[ ! -f /aws/mde/npk/README.md ]]; then
	echo "[*] Cloning the NPK repo"
	git clone https://github.com/c6fc/npk.git /aws/mde/npk > /dev/null
fi

# Run the deploy:
cd /aws/mde/npk
git pull

echo
echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
echo "[+] Installing Node.js prerequisites. This can take up to two minutes, and may appear frozen. DON'T INTERRUPT IT."
echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
echo
echo

export INIT_CWD="$PWD"
npm install > /dev/null

bash -c "exec node bin/index.js deploy -y < /dev/tty"

cd /aws/mde/npk
export PS1="\e[1m\e[32m@c6fc/npk>\e[0m "
return 0