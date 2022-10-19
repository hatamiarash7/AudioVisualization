FROM nginx:1.23.2-alpine

COPY . /usr/share/nginx/html/

CMD ["nginx", "-g", "daemon off;"]
