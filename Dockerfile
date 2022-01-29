FROM node:15.8.0

RUN npm install

CMD [ "node", "index.js" ]