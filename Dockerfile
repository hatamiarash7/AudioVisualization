FROM nginx:1.17.6-alpine

COPY . /usr/share/nginx/html/

CMD ["nginx", "-g", "daemon off;"]
