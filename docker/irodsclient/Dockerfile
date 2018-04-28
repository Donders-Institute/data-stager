FROM centos:7

MAINTAINER Hurng-Chun Lee <h.lee@donders.ru.nl>

RUN ( yum -y install epel-release )

RUN ( yum -y install wget gcc gcc-c++ \
                     make autoconf git zlib zlib-devel \
                     openssl openssl-devel openssl-libs \
                     sssd-client \
                     environment-modules which \
                     help2man unixODBC fuse-devel \
                     bzip2-devel pam-devel perl-JSON \
                     curl curl-devel libxml2-devel )

RUN ( rpm --import https://packages.irods.org/irods-signing-key.asc && \ 
      wget -qO - https://packages.irods.org/renci-irods.yum.repo | \
      tee /etc/yum.repos.d/renci-irods.yum.repo )

RUN ( yum -y install irods-devel irods-runtime irods-icommands && \
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
