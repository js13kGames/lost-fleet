#!/bin/bash

set -e

SOURCE='public/*.js'

mkdir -p target

uglifyjs --compress --output target/index.min.js -- $SOURCE

zip -r final.zip target

if [ $(uname) = Darwin ]; then
  flag=-f%z
else
  flag=-c%s
fi
size="$(stat $flag final.zip)"
(( percent = size * 100 / 13312 ))

echo "Size is $size"
if [ $size -gt 13312 ]; then
  echo "Too big!"
  exit 1
else
  echo "Percentage: $percent"
fi
