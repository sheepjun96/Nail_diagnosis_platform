FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/nginx.conf
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
