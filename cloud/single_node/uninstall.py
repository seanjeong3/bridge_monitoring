import os


### Computer-specfic variable ###
home = os.path.expanduser('~')

### Read metadata ###
DataDir = '/datadrive/cassandra'
DownloadDir = '{0}/cip_setup_tmp'.format(home)
CassandraDir = '/opt'
CassandraLinkDir = '{0}/cassandra'.format(home)

### Remove Cassandra ###
os.system('sudo rm -rf {0}'.format(CassandraLinkDir))
os.system('sudo rm -rf {0}/apache-cassandra-3.7'.format(CassandraDir))
os.system('sudo rm -rf {0}'.format(DataDir))
os.system('sudo rm -rf {0}'.format(DownloadDir))