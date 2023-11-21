FROM irodsclient

# application metadata
LABEL donders.ru.nl.app_name "stager"
LABEL donders.ru.nl.app_maintainer "h.lee@donders.ru.nl"
LABEL donders.ru.nl.app_code_repository "https://github.com/Donders-Institute/data-stager"

# # install cyberduck command-line interface
# RUN ( echo -e "[duck-stable]\n\
# name=duck-stable\n\
# baseurl=https://repo.cyberduck.io/stable/\$basearch/\n\
# enabled=1\n\
# gpgcheck=0" > /etc/yum.repos.d/duck-stable.repo )

# RUN ( yum -y install duck && yum clean all && rm -rf /var/cache/yum/* && rm -rf /tmp/* )

# create temporary directory
RUN ( mkdir -p /tmp )
WORKDIR /tmp

# install python 2.7.12
ADD https://www.python.org/ftp/python/2.7.12/Python-2.7.12.tgz /tmp
RUN ( if [ ! -d Python-2.7.12 ]; then tar xvf Python-2.7.12.tgz; fi \
      && cd Python-2.7.12 \
      && ./configure --prefix=/opt/python \
      && make && make install && rm -rf /tmp/Python-* )

# install python pip
RUN ( wget https://bootstrap.pypa.io/pip/2.7/get-pip.py && \
      /opt/python/bin/python get-pip.py )

# install pycurl
RUN ( /opt/python/bin/pip install pycurl )

#ADD https://github.com/pycurl/pycurl/archive/refs/tags/REL_7_43_0.tar.gz /tmp
#RUN ( if [ ! -d pycurl-REL_7_43_0 ]; then tar xvf REL_7_43_0.tar.gz; fi \
#      && cd pycurl-REL_7_43_0 \
#      && /opt/python/bin/python setup.py --with-nss install && rm -rf /tmp/pycurl-* )

# install nodejs
#ADD https://nodejs.org/dist/v6.11.2/node-v6.11.2-linux-x64.tar.xz /tmp
#ADD https://nodejs.org/dist/latest-v9.x/node-v9.11.2-linux-x64.tar.xz /tmp
ADD https://nodejs.org/dist/latest-v10.x/node-v10.24.1-linux-x64.tar.xz /tmp

RUN ( if [ ! -d node-v10.24.1-linux-x64 ]; then tar xf node-v10.24.1-linux-x64.tar.xz; fi \
      && mv node-v10.24.1-linux-x64 /opt/nodejs && rm -rf /tmp/node-*)

# install expect so that we get unbuffer to get irsync progress, progressively
RUN ( ulimit -n 1024 && yum -y install expect parallel bc samba-client cifs-utils && yum clean all && rm -rf /var/cache/yum/* && rm -rf /tmp/* )

# install stager scripts and required nodejs modules
RUN ( mkdir -p /opt/stager/bin )
WORKDIR /opt/stager
COPY package.json package.json
RUN ( export PATH=/opt/nodejs/bin:$PATH && export USER=root && /opt/nodejs/bin/npm install -g node-gyp && /opt/nodejs/bin/npm install --unsafe-perm )
COPY *.js ./
COPY bin ./bin
COPY lib ./lib
COPY routes ./routes
COPY start_stager.sh start_stager.sh
COPY config_stager.py config_stager.py
RUN ( chmod +x start_stager.sh )
RUN ( chmod +x config_stager.py )

# install devcron
RUN ( /opt/python/bin/pip install -e git+https://github.com/dbenamy/devcron#egg=devcron )

# copy default crontab and cron-job scripts into container
RUN ( mkdir -p /cron )
COPY cron/crontab /cron/crontab
COPY cron/renew_irods_token.sh /cron/renew_irods_token.sh
COPY cron/updateProject2Collection.sh /cron/updateProject2Collection.sh
RUN ( chmod +x /cron/*.sh )

# install Cheetah template engine
# force Markdown library to version 3.1, the last version supporting python 2.7
RUN ( /opt/python/bin/pip install Markdown==3.1 )
RUN ( wget https://pypi.python.org/packages/cd/b0/c2d700252fc251e91c08639ff41a8a5203b627f4e0a2ae18a6b662ab32ea/Cheetah-2.4.4.tar.gz#md5=853917116e731afbc8c8a43c37e6ddba && tar xvzf Cheetah-2.4.4.tar.gz && \
      cd Cheetah-2.4.4 && /opt/python/bin/python setup.py install )

# install supervisor
RUN ( ulimit -n 1024 && yum -y install epel-release )
RUN ( ulimit -n 1024 && yum -y install supervisor )
COPY supervisord.conf /opt/stager/supervisord.conf

RUN ( yum -y clean all )

# install jq
RUN ( curl -L -o /usr/bin/jq https://github.com/stedolan/jq/releases/download/jq-1.6/jq-linux64 && chmod +x /usr/bin/jq )

# runtime environment variables
ENV IRODS_ADMIN_USER=irods
ENV IRODS_ADMIN_CREDENTIAL=/opt/stager/config/secret
ENV IRODS_ICAT_HOST=irods-icat
ENV IRODS_ZONE_PORT=1247
ENV IRODS_ZONE_NAME=rdmtst
ENV IRODS_REST_ENDPOINT=https://irods-rest
ENV DAVRODS_ENDPOINT=https://irods-webdav
ENV DAVRODS_EXPOSED_ROOT=/rdmtst/di
ENV DAVRODS_EXPOSED_ROOT=/rdmtst/di

# runtime environment required for updateProject2Collection.sh
ENV PROJECT_FORM_API_SERVER=https://project-proposal
ENV AUTH_SERVER=https://authserver
ENV AUTH_CLIENT_ID=client_id
ENV AUTH_CLIENT_SECRET=client_secret

# run a stager and devcron from supervisor
VOLUME [ "/project", "/cron", "/opt/stager/config", "/opt/stager/log" ]
EXPOSE 3000

RUN ( echo "export PYTHON_BINDIR=/opt/python/bin" > /opt/stager/envvars && \
      echo "export PYTHON_LIBDIR=/opt/stager/lib/python" >> /opt/stager/envvars && \
      echo "export NODEJS_PREFIX=/opt/nodejs" >> /opt/stager/envvars )

CMD [ "/usr/bin/supervisord", "-c", "/opt/stager/supervisord.conf" ]
