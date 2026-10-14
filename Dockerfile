FROM nginx:1.31.7-alpine

COPY . /usr/share/nginx/html/

CMD ["nginx", "-g", "daemon off;"]
