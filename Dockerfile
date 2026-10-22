FROM nginx:1.31.8-alpine

COPY . /usr/share/nginx/html/

CMD ["nginx", "-g", "daemon off;"]
