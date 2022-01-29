FROM node:15.8.0

ADD index.js /index.js
ADD package.json /package.json
ADD package-lock.json /package-lock.json

RUN cd / && npm install

CMD [ "node", "/index.js" ]