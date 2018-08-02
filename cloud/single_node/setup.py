import os
import socket
import sys

# Check argument
if len(sys.argv) != 2:
	print('You must provide one argument (install or uninstall).')
	exit(0)
arg1 = sys.argv[1]

### Computer-specfic variable ###
home = os.path.expanduser('~')
hostname = socket.gethostname()   
IPAddress = socket.gethostbyname(hostname) 

### Read metadata - Cassandra ###
DataDir = '/datadrive/cassandra'
DownloadDir = '{0}/cip_setup_tmp'.format(home)
CassandraDir = '/opt/apache-cassandra-3.7'
CassandraLinkDir = '{0}/cassandra'.format(home)
ClusterName = 'Test Cluster'
Seeds = IPAddress
ListenAddress = 'localhost'

### Read metadata - Node.js ###
WebserverDir = '{0}/webserver'.format(home)

### Read metadata - Node.js ###
MessagebrokerDir = '{0}/messagebroker'.format(home)


##### Install Dependencies #####
def InstallDependency():
	os.system('sudo apt-get update')
	os.system('sudo apt install openjdk-8-jre-headless')
	

##### Cassandra setup #####
def InstallCassandra():
	### Install pacakages required by Cassandra DB ###
	os.system('sudo apt install python-pip')
	os.system('pip install cassandra-driver')

	### Create Cassandra DB data repository folder ###
	os.system('sudo mkdir -p {0}'.format(DataDir))
	os.system('sudo chown -R $USER:$GROUP {0}'.format(DataDir))

	### Download Cassandra installer from archive ###
	os.system('mkdir -p {0}'.format(DownloadDir))
	os.system('wget http://archive.apache.org/dist/cassandra/3.7/apache-cassandra-3.7-bin.tar.gz -P {0}'.format(DownloadDir))

	### Install (unzip) Cassandra installer ###
	os.system('tar -zxvf {0}/apache-cassandra-3.7-bin.tar.gz -C {0}'.format(DownloadDir))
	os.system('sudo mkdir -p {0}'.format(CassandraDir))
	os.system('sudo mv {0}/apache-cassandra-3.7/* {1}'.format(DownloadDir, CassandraDir))
	os.system('sudo chown -R $USER:$GROUP {0}'.format(CassandraDir))
	os.system('ln -s {0} {1}'.format(CassandraDir, CassandraLinkDir))

	### Update configuration file (cassandra.yaml, cassandra-topology.properties, cassandra-rackdc.properties) ###
	with open('{0}/conf/cassandra.yaml'.format(CassandraLinkDir), 'r') as f :
		filedata = f.read()
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
	with open('{0}/conf/cassandra.yaml'.format(CassandraLinkDir), 'w') as f :
		f.write(filedata)

	### Export Cassandra path ###
	os.system('export CQLSH_NO_BUNDLED=true')
	os.system('export PATH="/opt/apache-cassandra-3.7/bin:$PATH"')

	### Make session keep alive ###
	os.system('sudo sysctl -w net.ipv4.tcp_keepalive_time=60 net.ipv4.tcp_keepalive_probes=3 net.ipv4.tcp_keepalive_intvl=10')

	### Enable auth ###
	os.system('mkdir {0}/.cassandra'.format(home))
	os.system('touch {0}/.cassandra/cqlshrc'.format(home))
	os.system('echo "[authentication]" >> {0}/.cassandra/cqlshrc'.format(home))
	os.system('echo "username = cassandra" >> {0}/.cassandra/cqlshrc'.format(home))
	os.system('echo "password = cassandra" >> {0}/.cassandra/cqlshrc'.format(home))
	# Download schema
	# Install npm packages


def UninstallCassandra():
	### Check Cassandra process ###
	os.system('pkill -f \'java.*cassandra\'')

	### Remove old system ###
	os.system('sudo rm -rf {0}'.format(CassandraLinkDir))
	os.system('sudo rm -rf {0}'.format(CassandraDir))
	os.system('sudo rm -rf {0}'.format(DataDir))
	os.system('sudo rm -rf {0}'.format(DownloadDir))
	os.system('sudo rm -rf {0}/.cassandra'.format(home))


##### Node.js Setup #####
def InstallNodejs():
	os.system('curl -sL https://deb.nodesource.com/setup_9.x | sudo -E bash -')
	os.system('sudo apt-get install -y nodejs')
	os.system('sudo apt install npm')
	# Download webserver script
	# Install npm packages


##### Webserver Setup #####
def InstallWebserver():
	return 0 

def UninstallWebserver():
	return 0 

##### Messagebroker Setup #####
def InstallMessagebroker():
	return 0 

def UninstallMessagebroker():
	return 0 


if arg1 == 'install':
	while True:
		ans = raw_input('This action will remove data in directories {0}, {1}, {2} and {3} and install a new platform. Do you want to proceed? (yes/no): '.format(DataDir, DownloadDir, CassandraDir, CassandraLinkDir))
		if ans == 'yes':
			break
		elif ans == 'no':
			print('Installation has been canceled.')
			exit(0)
		else:
			print('Please answer in "yes" or "no".')

	InstallDependency()
	UninstallCassandra()
	InstallCassandra()
	InstallNodejs()


	UninstallWebserver() # Remove W/S from the target dir
	InstallWebserver() # Move W/S to the target dir & install npm
	UninstallMessagebroker() # Remove M/B from the target dir
	InstallMessagebroker() # Move W/S


elif arg1 == 'uninstall':
	while True:
		ans = raw_input('This action will remove data in directories {0}, {1}, {2} and {3}. Do you want to proceed? (yes/no): '.format(DataDir, DownloadDir, CassandraDir, CassandraLinkDir))
		if ans == 'yes':
			break
		elif ans == 'no':
			print('Uninstall has been canceled.')
			exit(0)
		else:
			print('Please answer in "yes" or "no".')
	UninstallCassandra()


else:
	print('Invalid argument {0}.'.format(arg1))
	exit(0)

	