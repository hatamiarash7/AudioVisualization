FROM nginx:1.24.0-alpine

COPY . /usr/share/nginx/html/

CMD ["nginx", "-g", "daemon off;"]
