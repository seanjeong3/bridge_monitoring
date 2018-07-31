import os
import socket   

### Read metadata ###
DataDir = '/datadrive/cassandra'
DownloadDir = '~/cip_setup_tmp'
CassandraDir = '/opt'
CassandraLinkDir = '~/cassandra'
ClusterName = 'Test Cluster'
Seeds = '127.0.0.1'
ListenAddress = 'localhost'
BroadcastAddress = 'localhost'


### Get IP address
hostname = socket.gethostname()   
IPAddress = socket.gethostbyname(hostname) 

##### Cassandra setup #####

### Create Cassandra DB data repository folder ###
os.system('sudo mkdir -p {0}'.format(DataDir))
os.system('sudo chown -R $USER:$GROUP {0}'.format(DataDir))

### Install pacakages required by Cassandra DB ###
os.system('sudo apt-get update')
os.system('sudo apt install openjdk-8-jre-headless')
os.system('sudo apt install python-pip')
os.system('pip install cassandra-driver')

### Download Cassandra installer from archive ###
os.system('mkdir -p {0}'.format(DownloadDir))
os.system('wget http://archive.apache.org/dist/cassandra/3.7/apache-cassandra-3.7-bin.tar.gz -P {0}'.format(DownloadDir))

### Install (unzip) Cassandra installer ###
os.system('tar -zxvf {0}/apache-cassandra-3.7-bin.tar.gz -C {0}'.format(DownloadDir))
os.system('sudo mv {0}/apache-cassandra-3.7 {1}'.format(DownloadDir, CassandraDir))
os.system('sudo chown -R $USER:$GROUP {0}/apache-cassandra-3.7/'.format(CassandraDir))
os.system('ln -s {0}/apache-cassandra-3.7/ {1}'.format(CassandraDir, CassandraLinkDir))

### Update configuration file (cassandra.yaml, cassandra-topology.properties, cassandra-rackdc.properties) ###
with open('CassandraLinkDir/conf/cassandra.yaml', 'r') as f :
	filedata = f.read()
	f.close()
filedata = filedata.replace('cluster_name: \'Test Cluster\'', 'cluster_name: \'{0}\''.format(ClusterName))
filedata = filedata.replace('# hints_directory: /var/lib/cassandra/hints', 'hints_directory: {0}'.format(DataDir))
filedata = filedata.replace('authenticator: AllowAllAuthenticator', 'authenticator: PasswordAuthenticator')
filedata = filedata.replace('authorizer: AllowAllAuthorizer', 'authorizer: CassandraAuthorizer')
filedata = filedata.replace('# data_file_directories:', 'data_file_directories:')
filedata = filedata.replace('#     - /var/lib/cassandra/data', '     - {0}/data'.format(DataDir))
filedata = filedata.replace('# commitlog_directory: /var/lib/cassandra/commitlog', 'commitlog_directory: {0}/commitlog'.format(DataDir))
filedata = filedata.replace('# saved_caches_directory: /var/lib/cassandra/saved_caches', 'saved_caches_directory: {0}/saved_caches'.format(DataDir))
filedata = filedata.replace('- seeds: "127.0.0.1"', '- seeds: "{0}"'.format(Seeds))
filedata = filedata.replace('listen_address: localhost', 'listen_address: {0}'.format(ListenAddress))
filedata = filedata.replace('# broadcast_address: 1.2.3.4', 'broadcast_address: {0}'.format(IPAddress))
filedata = filedata.replace('rpc_address: localhost', 'rpc_address: 0.0.0.0')
filedata = filedata.replace('# broadcast_rpc_address: 1.2.3.4', 'broadcast_rpc_address: {0}'.format(IPAddress))
filedata = filedata.replace('# rpc_min_threads: 16', 'rpc_min_threads: 8')
filedata = filedata.replace('# rpc_max_threads: 2048', 'rpc_max_threads: 256')
filedata = filedata.replace('read_request_timeout_in_ms: 5000', 'read_request_timeout_in_ms: 20000')
filedata = filedata.replace('range_request_timeout_in_ms: 10000', 'range_request_timeout_in_ms: 60000')
filedata = filedata.replace('write_request_timeout_in_ms: 2000', 'write_request_timeout_in_ms: 30000')
filedata = filedata.replace('counter_write_request_timeout_in_ms: 5000', 'counter_write_request_timeout_in_ms: 30000')
filedata = filedata.replace('cas_contention_timeout_in_ms: 1000', 'cas_contention_timeout_in_ms: 10000')
filedata = filedata.replace('truncate_request_timeout_in_ms: 60000', 'truncate_request_timeout_in_ms: 60000')
filedata = filedata.replace('request_timeout_in_ms: 10000', 'request_timeout_in_ms: 10000')
filedata = filedata.replace('endpoint_snitch: SimpleSnitch', 'endpoint_snitch: SimpleSnitch')
filedata = filedata.replace('dynamic_snitch_reset_interval_in_ms: 600000', 'dynamic_snitch_reset_interval_in_ms: 600000')
filedata = filedata.replace('batch_size_warn_threshold_in_kb: 5', 'batch_size_warn_threshold_in_kb: 5000')
filedata = filedata.replace('batch_size_fail_threshold_in_kb: 50', 'batch_size_fail_threshold_in_kb: 50000')
filedata += '\n'
filedata += 'auto_bootstrap: false'

with open('CassandraLinkDir/conf/cassandra.yaml', 'w') as f :
	f.write(filedata)
	f.close()



### Export Cassandra path ###

### Make session keep alive ###

### Enable auth-auth ###

### Apply data schema ###


##### Node.js Setup #####