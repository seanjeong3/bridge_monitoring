import os

SIGTERM = 15

def pidof(image):
    matching_proc_images = []
    for pid in [dir for dir in os.listdir('/proc') if dir.isdigit()]:
        lines = open('/proc/%s/status' % pid, 'r').readlines()
        for line in lines:
            if line.startswith('Name:'):
                name = line.split(':', 1)[1].strip()
                if name == image:
                    matching_proc_images.append(int(pid))

    return matching_proc_images


for pid in pidof('tomcat'): os.kill(pid, SIGTERM)