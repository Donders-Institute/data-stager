FROM centos:7

# create temporary directory
RUN ( mkdir -p /tmp )
WORKDIR /tmp

# install nodejs
ARG nodejs_prefix=/opt/nodejs
ADD https://nodejs.org/dist/v4.4.7/node-v4.4.7-linux-x64.tar.xz /tmp
RUN ( tar xf node-v4.4.7-linux-x64.tar.xz && mv node-v4.4.7-linux-x64 $nodejs_prefix )

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
RUN ( $nodejs_prefix/bin/npm install )

# run a stager-ui
ENV NODEJS_PREFIX $nodejs_prefix
VOLUME [ "/opt/stager-ui/config" ]
EXPOSE 80
CMD [ "/opt/stager-ui/start_stager-ui.sh" ]
