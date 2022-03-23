FROM node:15.8.0

ADD index.js /index.js
ADD lib/github.js /lib/github.js
ADD lib/bitbucket.js /lib/bitbucket.js
ADD package.json /package.json
ADD package-lock.json /package-lock.json

RUN cd / && npm install

CMD [ "node", "/index.js" ]