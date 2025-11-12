# WEB Server Deployment

## Current domain 
{alpha,beta,gamma,delta,epsilon}.peachhub-cntr1.inf.ethz.ch
e.g. https://alpha.peachhub-cntr1.inf.ethz.ch/
note: currently all domains are taken, more domain can be created by isg through request.

## Deployment demonstration
Access to server need permission, please contact April first to get permission
1. Build image with a given tag name: (see Dockerfile example: https://github.com/ETH-PEACH-Lab/ITC-handbook/blob/main/web-server/Dockerfile  and local docker yml file example: https://github.com/ETH-PEACH-Lab/ITC-handbook/blob/main/web-server/docker-compose.yml)
   `docker build -t <your-image-name>`
2. Create and run a container and map a port on the host machine to a port on the Docker container:

   `docker run --name <your-container-name> -p host_port:container_port <your-image-name>`
4. Pack your project into docker image(on your local machine):

   `docker-compose build`
6. Upload your docker image to GitHub (on your local machine):
   
   `echo <your GitHub access token> | docker login ghcr.io -u <your_github_username> --password-stdin`
   
   `docker tag <your_docker_image_tag>:latest ghcr.io/eth-peach-lab/<path for storing docker image>`
   
   `docker push ghcr.io/eth-peach-lab/<path for storing docker image>`
8. Download your docker image and deploy (on server)
   
   `ssh <your eth username>@peachlab-cntr1.inf.ethz.ch`
   
   `cd /opt/containers`
   
   (first time) `mkdir <your project folder>`

   `cd <your project folder>`
   
   put your docker-compose.yml file inside your project folder (see server docker yml file example: https://github.com/ETH-PEACH-Lab/ITC-handbook/blob/main/web-server/docker-compose_on_server.yml)
   
   `docker login ghcr.io`
   
   `docker pull ghcr.io/eth-peach-lab/<your_docker_image_path>`
   
   `docker compose -f docker-compose.yml up -d`
