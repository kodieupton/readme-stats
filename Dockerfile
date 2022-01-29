FROM node:15.8.0

COPY . /

RUN npm install

CMD [ "node", "/index.js" ]