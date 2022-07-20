FROM nginx:1.23.1-alpine

COPY . /usr/share/nginx/html/

CMD ["nginx", "-g", "daemon off;"]
