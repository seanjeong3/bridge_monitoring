import os

### Read metadata ###
DataDir = '/datadrive/cassandra'
DownloadDir = '~/cip_setup_tmp'
CassandraDir = '/opt'
CassandraLinkDir = '~/cassandra'

##### Cassandra setup #####

### Create Cassandra DB data repository folder ###
os.system('sudo mkdir -p {0}'.format(DataDir))
os.system('sudo chown -R $USER:$GROUP {0}'.format(DataDir))

# ### Install pacakages required by Cassandra DB ###
# os.system('sudo apt-get update')
# os.system('sudo apt install openjdk-8-jre-headless')
# os.system('sudo apt install python-pip')
# os.system('pip install cassandra-driver')

# ### Download Cassandra installer from archive ###
# os.system('mkdir {0}'.format(DownloadDir))
# os.system('wget http://archive.apache.org/dist/cassandra/3.7/apache-cassandra-3.7-bin.tar.gz -P {0}'.format(DownloadDir))

# ### Install (unzip) Cassandra installer ###
# os.system('tar -zxvf {0}/apache-cassandra-3.7-bin.tar.gz -C {0}'.format(DownloadDir))
# os.system('sudo mv {0}/apache-cassandra-3.7 {1}'.format(DownloadDir, CassandraDir))
# os.system('sudo chown -R $USER:$GROUP {0}/apache-cassandra-3.7/'.format(CassandraDir))
# os.system('ln -s {0}/apache-cassandra-3.7/ {1}'.format(CassandraDir, CassandraLinkDir))

### Update configuration file (cassandra.yaml, cassandra-topology.properties, cassandra-rackdc.properties) ###

### Export Cassandra path ###

### Make session keep alive ###

### Enable auth-auth ###

### Apply data schema ###


##### Node.js Setup #####