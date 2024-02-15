FROM nginx:1.25.4-alpine

COPY . /usr/share/nginx/html/

CMD ["nginx", "-g", "daemon off;"]
