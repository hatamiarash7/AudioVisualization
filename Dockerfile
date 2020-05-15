FROM nginx:1.17.9-alpine

COPY . /usr/share/nginx/html/

CMD ["nginx", "-g", "daemon off;"]
