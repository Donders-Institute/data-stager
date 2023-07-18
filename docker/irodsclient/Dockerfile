FROM centos:7

MAINTAINER Hurng-Chun Lee <h.lee@donders.ru.nl>

RUN ( ulimit -n 1024 && yum -y install epel-release )

RUN ( ulimit -n 1024 && yum -y install wget gcc gcc-c++ \
                     make autoconf git zlib zlib-devel \
                     openssl openssl-devel openssl-libs \
                     sssd-client \
                     environment-modules which \
                     help2man unixODBC fuse-devel \
                     bzip2-devel pam-devel perl-JSON \
                     curl curl-devel libxml2-devel )

RUN ( rpm --import https://packages.irods.org/irods-signing-key.asc )

RUN ( curl -L -o /etc/yum.repos.d/renci-irods.yum.repo https://packages.irods.org/renci-irods.yum.repo )

RUN ( ulimit -n 1024 && yum -y --enablerepo=renci-irods install irods-devel-4.2.8-1 irods-runtime-4.2.8-1 irods-icommands-4.2.8-1 && \
      yum clean all && \
      rm -rf /var/cache/yum/* && \
      rm -rf /tmp/* )

# prepare iRODS client environment
RUN ( mkdir -p  /opt/irods/ssl )
COPY irods_environment.json /opt/irods/irods_environment.json
ENV IRODS_ENVIRONMENT_FILE /opt/irods/irods_environment.json

# run a trivial command
WORKDIR /opt/irods
CMD ["/bin/echo", "hello"]
