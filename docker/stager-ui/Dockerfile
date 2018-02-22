FROM centos:7

# application metadata
MAINTAINER Donders Institute
LABEL donders.ru.nl.app_name "stager-ui"
LABEL donders.ru.nl.app_maintainer "h.lee@donders.ru.nl"
LABEL donders.ru.nl.app_code_repository "https://github.com/Donders-Institute/data-stager"

# create temporary directory
RUN ( mkdir -p /tmp )
WORKDIR /tmp

# install nodejs
ARG nodejs_prefix=/opt/nodejs
ADD https://nodejs.org/dist/v6.11.2/node-v6.11.2-linux-x64.tar.xz /tmp
RUN ( if [ ! -d node-v6.11.2-linux-x64 ]; then tar xf node-v6.11.2-linux-x64.tar.xz; fi \
      && mv node-v6.11.2-linux-x64 $nodejs_prefix )

# install the stager-ui nodejs applicaiton
RUN ( mkdir -p /opt/stager-ui/bin )
WORKDIR /opt/stager-ui
COPY package.json package.json
COPY *.js ./
COPY bin ./bin
COPY lib ./lib
COPY routes ./routes
COPY views ./views
COPY public ./public
COPY start_stager-ui.sh start_stager-ui.sh
RUN ( chmod +x start_stager-ui.sh )

# install nodejs modules for the application
RUN ( export PATH=$nodejs_prefix/bin:$PATH && /opt/nodejs/bin/npm install )

# prepare folder for trusted certificate
RUN ( mkdir -p /opt/stager-ui/ssl )

# runtime environment variables 
ENV UI_TITLE="File Stager for Donders Repository"
ENV UI_WEBSITE=https://data.donders.ru.nl
ENV EMAIL_HELPDESK=datasupport@donders.ru.nl
ENV LOGIN_TITLE_STAGER="Stager Storage"
ENV LOGIN_HINT_STAGER="Sign in with the stager system account"
ENV LOGIN_TITLE_RDM="Donders Repository"
ENV LOGIN_HINT_RDM="Sign in with the data-access account"
ENV DAVRODS_ENDPOINT=https://irods-webdav
ENV DAVRODS_EXPOSED_ROOT=/rdmtst/di

ENV TURL_PREFIX_RDM=irods:${DAVRODS_EXPOSED_ROOT}

# run a stager-ui
ENV NODEJS_PREFIX $nodejs_prefix
VOLUME [ "/opt/stager-ui/config" ]
EXPOSE 3080
CMD [ "/opt/stager-ui/start_stager-ui.sh" ]
