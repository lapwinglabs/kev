FROM mhart/alpine-node:12.3.1

ENV PATH=$PATH:/usr/src/node_modules/.bin
ARG NODE_ENV=test

# Install app
ENV NODE_ENV=$NODE_ENV
ENV NODE_PATH=/usr/src/kev
ADD package.json package-lock.json /tmp/
RUN cd /tmp && \
    npm install && \
    rm -rf /root/.npm && \
    mkdir -p /usr/src/kev && \
    ln -sf /tmp/node_modules /usr/src/kev/node_modules && \
    ln -sf /tmp/package.json /usr/src/kev/package.json

# Add source
WORKDIR /usr/src/kev
COPY .npmrc /usr/src/kev/.npmrc
COPY src /usr/src/kev/src

ENTRYPOINT [ "npm", "run" ]

# Default command
CMD [ "test" ]
