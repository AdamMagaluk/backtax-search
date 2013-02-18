#!/bin/bash
sudo apt-get update
sudo apt-get install build-essential git
curl https://raw.github.com/creationix/nvm/master/install.sh | sh
nvm install v0.8.20

git clone https://github.com/AdamMagaluk/backtax-search.git
cd backtax-search
npm install

