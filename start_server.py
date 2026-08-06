import subprocess, time, sys, os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

proc = subprocess.Popen(
    [sys.executable, 'server.py'],
    creationflags=0x00000008,
    stdout=open('server.log', 'w'),
    stderr=subprocess.STDOUT
)

print(f'Server started with PID {proc.pid}')
time.sleep(2)

if proc.poll() is not None:
    print(f'Server crashed! Exit code: {proc.returncode}')
    with open('server.log') as f:
        print(f.read())
else:
    print('Server is running')
