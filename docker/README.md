# Instruction

The docker containers are organised in the following sub-directories:

- `docker/irodsclient`: iRODS icommand client with proper setup for DI-RDM
- `docker/stager`: the stager service written in [Node.js](http://nodejs.org), and built on top of the [Kue](http://automattic.github.io/kue/) task scheduler.
- `docker/stager-ui`: the stager user interface

They are orchestrated by the docker-compose file `docker/docker-compose.yml`.

## requirements of docker host

- sufficient space on `/scratch/data_stager` for persistent [Redis](http://redis.io) database (for Kue)
- access to the project storage, i.e. the `/project` directory
- accepting inbound connectivity via port: `3000`

## configure the stager

You have to change the parameters in the file `docker/stager/config/default.json` for

- stager administrator's username and password (by default they are `admin` and `admin`)
- active directory binding information (to authenticate user for accessing the stager)
- username and one-time password for accessing RDM service
- WebDAV and RESTful endpoint for the RDM service (if the WebDAV interface is used for staging files)

## configure the stager-ui

## start docker containers for the service set "stager"

Build docker containers using the following command:

```bash
$ cd docker
$ docker-compose -f docker-compose.yml build --force-rm
```

Start up docker containers using the following command:

```bash
$ docker-compose -f docker-compose.yml up -d
```

If the services are started successfuly, the RESTful interface of the stager and stager-ui should be listening on port `3000` and `3080`, respectively.  You may check it by connecting the browser to `http://<dockerhost>:3000` or `http://<dockerhost>:3080`. 
