FROM nginxinc/nginx-unprivileged:1.31-alpine

LABEL org.opencontainers.image.title="Audio Visualization" \
      org.opencontainers.image.source="https://github.com/hatamiarash7/AudioVisualization"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --chown=nginx:nginx index.html /usr/share/nginx/html/
COPY --chown=nginx:nginx css/ /usr/share/nginx/html/css/
COPY --chown=nginx:nginx js/ /usr/share/nginx/html/js/
COPY --chown=nginx:nginx media/ /usr/share/nginx/html/media/

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
      CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
