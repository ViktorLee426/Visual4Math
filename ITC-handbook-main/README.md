# ITC-handbook

This is the handbook for the IT coordinator in the lab.

## Software Services

### Software Services from ETH

- ITSHOP: https://itshop.ethz.ch/(about buy IT spftware/license/service through ETH).
- Google Workshop: please follow the instruction here to apply google workshop account: https://unlimited.ethz.ch/spaces/itkb/pages/98593609/Google+Workspace
- IT knowledge base: https://unlimited.ethz.ch/display/itkb(Learn about eth wifi, vpn, google service and more)
- Cloud Storage: We can apply for the cloud storage in the IT shop (https://itshop.ethz.ch/EndUser/Items/Home) under Service Catalog -> Storage -> Polybox, to increase the storage of polybox from 50GB to 100GB.
- ETH templates for posters, slides, flyers, etc: https://ethz.ch/staffnet/en/service/communication/corporate-design/templates.html
- AEM website: https://ethz.ch/staffnet/en/service/communication/websites/aem-websites.html

### Software Services from the lab

We managed the shared accounts through LastPass (https://www.lastpass.com/).

#### OpenAI Subscription
Link: https://platform.openai.com/

- We put some credits on this shared account

#### Prolific
Link: https://www.prolific.com/

- We put some credits on this shared account

#### LeetCode Premium
Link: https://leetcode.com/

- We paid a one year subscription to the premium plan (2024-2025)

#### Slack Group
Link: https://join.slack.com/t/peach-lab-workspace/shared_invite/zt-2bzhpdzhy-R3P~S92TPa3gw68szjXRhA

- We are on a paid plan by per user. Would be great to actively manage the membership to save the costs.

#### Lab Page

Link: https://peachlab.inf.ethz.ch/

Repo: https://gitlab.inf.ethz.ch/prv-wang/peachlab-website

- April is managing this for now
- We need to create a new website once we have more things to show off


#### Mailing List

- April is managing this for now
- Internal mailing list for core members: peachlab@list.inf.ethz.ch
- External mailing list for people who follow our work: friends.peachlab@list.inf.ethz.ch
- A shared mailbox for people who are interested in working with us: peachlab@inf.ethz.ch

## Computing Services

### Euler
We owned two RTX 4090 GPUs from 2024-2028.

Wiki on how to use Euler:
- https://scicomp.ethz.ch/wiki/Main_Page
- https://scicomp.ethz.ch/wiki/Getting_started_with_clusters
- https://scicomp.ethz.ch/wiki/Getting_started_with_GPUs

Manage user access:
- https://www.isg.inf.ethz.ch/Main/ServicesUserAccountsDirectoriesGroupsEdit?group=wang-euler

Tips on Using Euler:
- Please ask Prof. Wang to permit you to use our group's Euler computing resources(core-member already have access), then ask Junling Wang to grant your permission.
- Notice the primary use case of Euler is training ML models, the computing node usually does not have access to the Internet, you need an external Internet node(eth_proxy) to access the Internet. Using Euler as the web server is complex and hardly used by others, please ask ISG if you have such use cases that must run on Euler.
- Access to Euler: ssh <your eth account>@euler.ethz.ch or use eth jupyter hub for experiment(cpu only): https://jupyter.euler.hpc.ethz.ch/
- Create a conda or virtual environment in cluster/project/wang/<your eth account name> folder (create your folder in this path if you haven't).
- You can run your code using the sbatch system with a .sh file. Use `sbatch <path to your .sh file>` to submit a job to Euler. Example .sh file: https://github.com/ETH-PEACH-Lab/ITC-handbook/blob/main/Euler/example.sh



### Web Server
the VM has just been delivered and setup as follows..

`peachlab-cntr1.inf.ethz.ch` has address `129.132.15.76`

Access to web server: ssh <eth account>@peachlab-cntr1.inf.ethz.ch
The password is your NETHZ password

`/dev/sda  ssd  120GB   (system)`
#### Step by step system deployment on server
Please refer to this file for deploying your system on server: 
https://github.com/ETH-PEACH-Lab/ITC-handbook/blob/main/DEPLOYMENT.md

#### Important Folders:

`/opt/containers/`         1GB   => configuration of the containers only
`/var/lib/peachlab/data`   10GB  => data of your container (mountpoints)
`/var/lib/peachlab/backup` 20GB  => backups of your container (mountpoints)

currently the lvm still has 20GB spare. If you need more space, the volumes can be increased at any time during operation. The VM disk can also be increased during operation and the new space distributed to the lvm volumes.

users_root:
 - `wangjun`
 - `apwang`

Access to `/opt/containers/` 
For Root user: sudo usermod -aG containerroot $USER
For normal user: echo umask 0007 >>~/.bashrc
After running such commands, then once logout and login you will have access to `/opt/containers/` .

As requested, it's a Redhat9 with managed Docker, Nginx-Proxy and Watchtower.

#### nginx-proxy with Letsencrypt

=> `https://github.com/nginx-proxy/nginx-proxy`

`/opt/containers/nginx-proxy.yml`  => `docker-compose.yml`

`/opt/containers/ngginx-proxy/conf.d/<fqdn>`  => special vhost configs

`/opt/containers/nginx-proxy-backend.env.tmpl`  => possible env variables

To publish a container via the nginx proxy, environment variables must be assigned to the container. The most important ones are.

````
VIRTUAL_HOST: 'foobar.example.com'
VIRTUAL_PORT: '1234'
LETSENCRYPT_HOST: 'foobar.example.com'
LETSENCRYPT_EMAIL: 'foobar@example.com'
````

#### watchower

=> `https://github.com/containrrr/watchtower`

`/opt/containers/watchtower.yml`  => `docker-compose.yml`

`/opt/containers/watchtower-token.yml`  => watchtower api token

To keep a container up-to-date via Watchtower, the following labels must be attached to the container to be monitored.

labels:
 - `com.centurylinklabs.watchtower.enable=true`
 - `com.centurylinklabs.watchtower.depends-on=/foobar`  (optional)
depends_on:
 - foobar (optional)

If your own container images are built in pipelines with Kaniko and are to be rolled out by Watchtower if successful, the Watchtower can be triggered from the pipeline with httpie. Normally Watchtower checks for updates every 24 hours.


#### default docker custom network

network_mode: `default-isg`

This is the custom network that we use for the managed containers.

To see how you should best configure the containers, you can find corresponding examples in our managed docker-compose yml under `/opt/containers/`.

You should create your own container projects as follows.
```
/opt/containers/foobar/
 .env
 docker-compose.yml
 ..

/var/lib/peachlab/data/foobar/..
/var/lib/peachlab/backup/foobar/..  
```

#### Subdomains
- https://peachlab-cntr1.inf.ethz.ch/
- https://hub.peachlab-cntr1.inf.ethz.ch/
- If we need to add new subdomains, we need to contact IT for this.
- Modify subdomains: https://www.isg.inf.ethz.ch/Main/ServicesNetworkITCoordinatorsDNSModifyIP?ip=129.132.15.76

## Hardware Devices

### Purchase form from ISG
https://www.isg.inf.ethz.ch/Main/ServicesHardwarePurchasing

### PCs
- One Macbook pro 14(2023) 18G memory, 1T SSD, with apple care+.
- Two Macbook pro 14(2024) 24G memory, 512G SSD, M4pro chip, with 3 years DQ-care, start from 20th Jan 2025 (begining time may vary because of activation time), currently occupied by Zeyu Xiong and Xiaotian Su.
- One Lenovo thinkpad T14s G4, Intel Core i5-1335U with windows 11 Pro. (Currently used by Peng Kuang)

### Tablet
- ipad pro 11 * 10

### Monitors
- Dell S2721DS (2560 x 1440 pixels, 27") * 8

### Keyboards & Mouse
- Logitech Bluetooth Keyboard and Mouse Set * 2

### Meeting Devices
- Samsung flip pro 4 touch screen
- Logitech meetup audio/video/microphone

### Meta Quest 3
We have a meta quest 3 in April's office. People are welcome to borrow it.

### AR Testing Devices
- Samsung Galaxy Tab S9 WiFi

### Printing Service
- The printer near CAB F16

## MISC
### LEGO
- LEGO Classic 1000 pcs * 2

## IT Resource Access Management, account management
https://docs.google.com/spreadsheets/d/1jFQmecxHcHom6xQfaNRx2C9xM5psSmme6xS7RuHQV4c/edit?usp=sharing

## The ITC team
- Junling Wang (03.2024 - now) junling.wang@ai.ethz.ch
