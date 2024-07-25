#!/bin/bash

# @Example: `bash build.sh -t <tag>`

tag=$(git describe --tags --always)

while getopts "t:" opt; do
  case ${opt} in
    t )
      tag=$OPTARG
      ;;
    \? )
      echo "Usage: $0 [-t tag]"
      exit 1
      ;;
  esac
done
shift $((OPTIND -1))

docker build . -t pillcounter-payment:$tag --platform=linux/amd64
