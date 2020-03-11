#!/bin/bash

#go build -o ../docker/stager/bin/isync scanner.go dirmaker.go main.go
go build -o isync scanner.go dirmaker.go main.go
