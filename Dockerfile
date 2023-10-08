FROM nginx:1.25.2-alpine

COPY . /usr/share/nginx/html/

CMD ["nginx", "-g", "daemon off;"]
